// app/api/pulse/route.ts
import { NextResponse } from 'next/server'
import { NseIndia } from 'stock-nse-india'

// ════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

const YAHOO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

// ════════════════════════════════════════════════════════════════
//  YAHOO HELPERS (macro + avg volume)
// ════════════════════════════════════════════════════════════════

async function fetchYahooQuote(symbol: string): Promise<any | null> {
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
            { headers: YAHOO_HEADERS, next: { revalidate: 60 } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const result = data?.chart?.result?.[0]
        if (!result) return null

        const meta = result.meta
        const quotes = result.indicators?.quote?.[0] || {}
        const currentPrice = meta?.regularMarketPrice || 0
        const previousClose = meta?.chartPreviousClose || meta?.previousClose || 0
        const change = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0
        const volumes = quotes.volume || []
        const latestVolume = volumes[volumes.length - 1] || 0
        const validVolumes = volumes.filter((v: number) => v && v > 0)
        const avgVolume = validVolumes.length > 1
            ? validVolumes.slice(0, -1).reduce((a: number, b: number) => a + b, 0) / (validVolumes.length - 1)
            : latestVolume

        return { price: currentPrice, previousClose, change, volume: latestVolume, avgVolume, volumeRatio: avgVolume > 0 ? latestVolume / avgVolume : 0 }
    } catch (e) { return null }
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

function toNSESymbol(ticker: string): string {
    return ticker.toUpperCase().replace('.NS', '').replace('.BO', '').replace(':NSE', '').trim()
}

function isIndianStock(ticker: string): boolean {
    const t = ticker.toUpperCase()
    return !t.includes('^') && !t.includes('=') && !t.startsWith('COMMODITY:')
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    const parts = dateStr.split(/[-\/\s]+/)
    if (parts.length === 3) {
        const attempt = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`)
        if (!isNaN(attempt.getTime())) return attempt
    }
    return null
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// ════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
    try {
        const { tickers } = await request.json()
        const uniqueTickers = Array.from(new Set((tickers || []) as string[]))

        const events: any[] = []
        const insiders: any[] = []
        const shockers: any[] = []
        const macro: any[] = []

        const now = Date.now()
        const sevenDaysAgo = new Date(now - 7 * 86400000)
        const ninetyDaysFromNow = new Date(now + 90 * 86400000)
        const oneEightyDaysAgo = new Date(now - 180 * 86400000)

        const indianTickers = uniqueTickers.filter(isIndianStock)
        const nonIndianTickers = uniqueTickers.filter(t => !isIndianStock(t))

        // ═══════════════════════════════════════════════════════
        //  PHASE 1: Fire macro + NSE init in parallel (zero blocking)
        // ═══════════════════════════════════════════════════════

        const nse = new NseIndia()

        // Macro + non-Indian shockers fire in parallel with NSE data
        const macroPromise = Promise.all(MACRO_TICKERS.map(async (m) => {
            const quote = await fetchYahooQuote(m.symbol)
            if (quote) {
                macro.push({
                    name: m.name, price: quote.price, change: quote.change,
                    type: m.type, prefix: m.prefix, suffix: m.suffix
                })
            }
        }))

        const nonIndianPromise = Promise.all(nonIndianTickers.map(async (ticker) => {
            const quote = await fetchYahooQuote(ticker)
            if (quote && quote.volumeRatio > 2.5 && quote.volume > 10000) {
                shockers.push({
                    ticker: ticker.replace('.NS', '').replace('.BO', ''),
                    volume: quote.volume, avgVolume: quote.avgVolume,
                    ratio: quote.volumeRatio.toFixed(1) + 'x', change: quote.change
                })
            }
        }))

        // ═══════════════════════════════════════════════════════
        //  PHASE 2: NSE data — parallel batches of 5
        // ═══════════════════════════════════════════════════════

        const nsePromise = (async () => {
            if (indianTickers.length === 0) return

            const BATCH = 5
            const BATCH_DELAY = 300

            for (let i = 0; i < indianTickers.length; i += BATCH) {
                const batch = indianTickers.slice(i, i + BATCH)

                await Promise.all(batch.map(async (ticker) => {
                    const sym = toNSESymbol(ticker)

                    // ── VOLUME SHOCKER ──
                    try {
                        const [tradeInfo, details, yahoo] = await Promise.all([
                            nse.getEquityTradeInfo(sym),
                            nse.getEquityDetails(sym),
                            fetchYahooQuote(ticker.includes('.') ? ticker : ticker + '.NS')
                        ])

                        const volume = tradeInfo?.marketDeptOrderBook?.tradeInfo?.totalTradedVolume || 0
                        const lastPrice = details?.priceInfo?.lastPrice || 0
                        const previousClose = details?.priceInfo?.previousClose || 0
                        const change = previousClose > 0 ? ((lastPrice - previousClose) / previousClose) * 100 : 0
                        const avgVolume = yahoo?.avgVolume || volume
                        const volumeRatio = avgVolume > 0 ? volume / avgVolume : 0

                        if (volumeRatio > 2.5 && volume > 10000) {
                            shockers.push({
                                ticker: sym, volume, avgVolume,
                                ratio: volumeRatio.toFixed(1) + 'x', change
                            })
                        }
                    } catch (e) { /* skip */ }

                    // ── CORPORATE INFO (actions, board meetings, financials) ──
                    try {
                        const corpInfo = await nse.getEquityCorporateInfo(sym)

                        // Corporate Actions
                        const actions = corpInfo?.corporate_actions?.data || []
                        actions.forEach((action: any) => {
                            const exDate = parseDate(action.exdate)
                            if (!exDate || exDate < sevenDaysAgo || exDate > ninetyDaysFromNow) return

                            const purpose = (action.purpose || '').toLowerCase()
                            let type = 'Corporate Action', desc = action.purpose || 'Corporate Action'

                            if (purpose.includes('dividend')) { type = 'Dividend'; desc = `Ex-Dividend: ${action.purpose}` }
                            else if (purpose.includes('split') || purpose.includes('sub-division')) { type = 'Split'; desc = `Stock Split: ${action.purpose}` }
                            else if (purpose.includes('bonus')) { type = 'Bonus'; desc = `Bonus Issue: ${action.purpose}` }
                            else if (purpose.includes('rights')) { type = 'Rights'; desc = `Rights Issue: ${action.purpose}` }
                            else if (purpose.includes('buyback')) { type = 'Buyback'; desc = `Buyback: ${action.purpose}` }

                            events.push({ ticker: sym, type, date: exDate.toISOString(), desc: desc.length > 80 ? desc.substring(0, 77) + '...' : desc })
                        })

                        // Board Meetings
                        const meetings = corpInfo?.borad_meeting?.data || []
                        meetings.forEach((meeting: any) => {
                            const meetingDate = parseDate(meeting.meetingdate)
                            if (!meetingDate || meetingDate < sevenDaysAgo || meetingDate > ninetyDaysFromNow) return
                            const purpose = meeting.purpose || 'Board Meeting'
                            events.push({
                                ticker: sym, type: 'Board Meeting',
                                date: meetingDate.toISOString(),
                                desc: purpose.length > 80 ? purpose.substring(0, 77) + '...' : purpose
                            })
                        })

                        // Financial Results → Earnings
                        const results = corpInfo?.financial_results?.data || []
                        results.slice(0, 1).forEach((result: any) => {
                            const toDate = parseDate(result.to_date)
                            if (!toDate || toDate < sevenDaysAgo) return
                            events.push({
                                ticker: sym, type: 'Earnings',
                                date: toDate.toISOString(),
                                desc: `Results: Income ₹${Number(result.income || 0).toLocaleString('en-IN')}Cr | EPS ₹${result.reDilEPS || 'N/A'}`
                            })
                        })
                    } catch (e) { /* skip */ }

                    // ── INSIDER TRADING ──
                    try {
                        const insiderData: any = await nse.getDataByEndpoint(
                            `/api/corporates-insider-trading?index=equities&symbol=${encodeURIComponent(sym)}`
                        )
                        const trades = Array.isArray(insiderData) ? insiderData : (insiderData?.data || [])

                        trades.forEach((trade: any) => {
                            const txnDate = parseDate(
                                trade.acqfromDt || trade.date || trade.intimDt || trade.acquisitionfromDate
                            )
                            if (!txnDate || txnDate < oneEightyDaysAgo) return

                            const shares = Number(trade.secAcq || trade.noOfSecurities || trade.securityAcq || 0)
                            const value = Number(trade.secVal || trade.befAcqSharesNo || 0)
                            const acqMode = (trade.acqMode || trade.acquisitionMode || '').trim()

                            insiders.push({
                                ticker: sym,
                                holder: trade.acquirerName || trade.acqName || trade.personName || 'Unknown',
                                relation: trade.personCategory || trade.categoryOfPerson || 'Promoter',
                                action: acqMode || 'Transaction',
                                shares: Math.abs(shares),
                                value: Math.abs(value),
                                date: txnDate.toISOString()
                            })
                        })
                    } catch (e) { /* skip */ }
                }))

                // Small delay between batches
                if (i + BATCH < indianTickers.length) await delay(BATCH_DELAY)
            }
        })()

        // ═══════════════════════════════════════════════════════
        //  Wait for everything
        // ═══════════════════════════════════════════════════════

        await Promise.all([macroPromise, nonIndianPromise, nsePromise])

        // ═══════════════════════════════════════════════════════
        //  PHASE 3: Sort & Deduplicate
        // ═══════════════════════════════════════════════════════

        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

        const uniqueEvents = events.filter((event, index, self) =>
            index === self.findIndex((e) =>
                e.ticker === event.ticker && e.type === event.type &&
                e.date.split('T')[0] === event.date.split('T')[0]
            )
        )

        const uniqueInsiders = insiders.filter((item, index, self) =>
            index === self.findIndex((e) =>
                e.ticker === item.ticker && e.holder === item.holder &&
                e.date.split('T')[0] === item.date.split('T')[0]
            )
        )

        return NextResponse.json({
            events: uniqueEvents,
            insiders: uniqueInsiders.slice(0, 50),
            shockers: shockers.slice(0, 20),
            macro
        })

    } catch (error: any) {
        console.error("Pulse API Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}