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
//  YAHOO: Macro + Average Volume (v8 chart — no auth needed)
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

        const indianTickers = uniqueTickers.filter(isIndianStock)
        const nonIndianTickers = uniqueTickers.filter(t => !isIndianStock(t))

        // Build a Set of NSE symbols for fast lookup when filtering broad data
        const userSymbols = new Set(indianTickers.map(toNSESymbol))

        const nse = new NseIndia()

        // ═══════════════════════════════════════════════════════
        //  ALL PHASES IN PARALLEL — zero sequential blocking
        // ═══════════════════════════════════════════════════════

        await Promise.all([

            // ─── A. MACRO DATA (Yahoo) ───
            ...MACRO_TICKERS.map(async (m) => {
                const quote = await fetchYahooQuote(m.symbol)
                if (quote) {
                    macro.push({
                        name: m.name, price: quote.price, change: quote.change,
                        type: m.type, prefix: m.prefix, suffix: m.suffix
                    })
                }
            }),

            // ─── B. VOLUME SHOCKERS (NSE trade info + Yahoo avg volume) ───
            ...indianTickers.map(async (ticker) => {
                const sym = toNSESymbol(ticker)
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
            }),

            // ─── C. NON-INDIAN VOLUME SHOCKERS (Yahoo) ───
            ...nonIndianTickers.map(async (ticker) => {
                const quote = await fetchYahooQuote(ticker)
                if (quote && quote.volumeRatio > 2.5 && quote.volume > 10000) {
                    shockers.push({
                        ticker: ticker.replace('.NS', '').replace('.BO', ''),
                        volume: quote.volume, avgVolume: quote.avgVolume,
                        ratio: quote.volumeRatio.toFixed(1) + 'x', change: quote.change
                    })
                }
            }),

            // ─── D. UPCOMING EVENTS — BROAD NSE endpoint (all stocks → filter by user tickers) ───
            (async () => {
                if (indianTickers.length === 0) return
                try {
                    const actionsData: any = await nse.getDataByEndpoint(
                        '/api/corporates-corporateActions?index=equities'
                    )
                    const actions = Array.isArray(actionsData) ? actionsData : []

                    actions.forEach((action: any) => {
                        // Only include events for user's stocks
                        if (!userSymbols.has(action.symbol)) return

                        const exDate = parseDate(action.exDate)
                        if (!exDate) return

                        const subject = (action.subject || '').toLowerCase()
                        let type = 'Corporate Action'
                        let desc = action.subject || 'Corporate Action'

                        if (subject.includes('dividend') || subject.includes('interim dividend')) {
                            type = 'Dividend'
                        } else if (subject.includes('split') || subject.includes('sub-division')) {
                            type = 'Split'
                        } else if (subject.includes('bonus')) {
                            type = 'Bonus'
                        } else if (subject.includes('rights')) {
                            type = 'Rights'
                        } else if (subject.includes('buyback')) {
                            type = 'Buyback'
                        }

                        events.push({
                            ticker: action.symbol,
                            type,
                            date: exDate.toISOString(),
                            desc: desc.length > 80 ? desc.substring(0, 77) + '...' : desc
                        })
                    })
                } catch (e) {
                    console.warn('[Pulse] Broad corporate actions failed:', (e as Error).message)
                }
            })(),

            // ─── E. UPCOMING BOARD MEETINGS — BROAD NSE endpoint ───
            (async () => {
                if (indianTickers.length === 0) return
                try {
                    const meetingsData: any = await nse.getDataByEndpoint(
                        '/api/corporate-board-meetings?index=equities'
                    )
                    const meetings = Array.isArray(meetingsData) ? meetingsData : []

                    meetings.forEach((meeting: any) => {
                        // Only include for user's stocks
                        if (!userSymbols.has(meeting.bm_symbol)) return

                        const meetingDate = parseDate(meeting.bm_date)
                        if (!meetingDate) return

                        const purpose = meeting.bm_purpose || 'Board Meeting'

                        events.push({
                            ticker: meeting.bm_symbol,
                            type: 'Board Meeting',
                            date: meetingDate.toISOString(),
                            desc: purpose.length > 80 ? purpose.substring(0, 77) + '...' : purpose
                        })
                    })
                } catch (e) {
                    console.warn('[Pulse] Broad board meetings failed:', (e as Error).message)
                }
            })(),

            // ─── F. INSIDER-LIKE DATA — NSE announcements (partial substitute) ───
            (async () => {
                if (indianTickers.length === 0) return

                const BATCH = 5
                for (let i = 0; i < indianTickers.length; i += BATCH) {
                    const batch = indianTickers.slice(i, i + BATCH)

                    await Promise.all(batch.map(async (ticker) => {
                        const sym = toNSESymbol(ticker)
                        try {
                            const corpInfo = await nse.getEquityCorporateInfo(sym)

                            // Latest announcements — filter for SAST / insider-related
                            const announcements = corpInfo?.latest_announcements?.data || []
                            const oneEightyDaysAgo = new Date(Date.now() - 180 * 86400000)

                            announcements.forEach((ann: any) => {
                                const subject = (ann.subject || '').toLowerCase()
                                const date = parseDate(ann.broadcastdate)
                                if (!date || date < oneEightyDaysAgo) return

                                // Filter for insider/SAST/acquisition-related announcements
                                const isInsiderRelated = (
                                    subject.includes('acquisition') ||
                                    subject.includes('sast') ||
                                    subject.includes('insider') ||
                                    subject.includes('promoter') ||
                                    subject.includes('pledge') ||
                                    subject.includes('shareholding') ||
                                    subject.includes('substantial')
                                )

                                if (isInsiderRelated) {
                                    // Determine action type from subject
                                    let action = 'Disclosure'
                                    if (subject.includes('pledge')) action = 'Pledge Update'
                                    else if (subject.includes('acquisition')) action = 'Acquisition'
                                    else if (subject.includes('sast') || subject.includes('substantial')) action = 'SAST Disclosure'
                                    else if (subject.includes('promoter') && subject.includes('holding')) action = 'Promoter Holding Update'
                                    else if (subject.includes('insider')) action = 'Insider Disclosure'

                                    insiders.push({
                                        ticker: sym,
                                        holder: ann.symbol || sym,
                                        relation: 'Company Disclosure',
                                        action,
                                        shares: 0,
                                        value: 0,
                                        date: date.toISOString()
                                    })
                                }
                            })
                        } catch (e) { /* skip */ }
                    }))

                    if (i + BATCH < indianTickers.length) await delay(200)
                }
            })(),
        ])

        // ═══════════════════════════════════════════════════════
        //  SORT & DEDUPLICATE
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