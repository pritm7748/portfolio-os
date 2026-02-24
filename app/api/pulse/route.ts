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
//  YAHOO FINANCE (Global macro + volume avg fallback)
// ════════════════════════════════════════════════════════════════

async function fetchYahooQuote(symbol: string): Promise<any | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
        const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 60 } })
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

        return { symbol: meta?.symbol || symbol, price: currentPrice, previousClose, change, volume: latestVolume, avgVolume, volumeRatio: avgVolume > 0 ? latestVolume / avgVolume : 0 }
    } catch (e) {
        return null
    }
}

/** Fetch dividend/split events from Yahoo v8 chart (no auth) */
async function fetchYahooEvents(symbol: string): Promise<{ dividends: any[], splits: any[] }> {
    try {
        const period1 = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60)
        const period2 = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div|split`
        const res = await fetch(url, { headers: YAHOO_HEADERS })
        if (!res.ok) return { dividends: [], splits: [] }
        const data = await res.json()
        const events = data?.chart?.result?.[0]?.events || {}
        return {
            dividends: events.dividends ? Object.values(events.dividends) : [],
            splits: events.splits ? Object.values(events.splits) : []
        }
    } catch (e) {
        return { dividends: [], splits: [] }
    }
}

// ════════════════════════════════════════════════════════════════
//  YAHOO CRUMB + QUOTESUMMARY (for insider trading fallback)
// ════════════════════════════════════════════════════════════════

let cachedCrumb: string | null = null
let cachedCookies: string | null = null
let crumbExpiry: number = 0

async function getYahooCrumb(): Promise<{ crumb: string; cookies: string } | null> {
    if (cachedCrumb && cachedCookies && Date.now() < crumbExpiry) {
        return { crumb: cachedCrumb, cookies: cachedCookies }
    }
    try {
        const initRes = await fetch('https://finance.yahoo.com/quote/AAPL', {
            headers: YAHOO_HEADERS, redirect: 'follow'
        })
        if (!initRes.ok) return null
        const setCookies = initRes.headers.getSetCookie?.() || []
        const cookieString = setCookies.map(c => c.split(';')[0]).join('; ')
        const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
            headers: { ...YAHOO_HEADERS, 'Cookie': cookieString }
        })
        if (!crumbRes.ok) return null
        const crumb = await crumbRes.text()
        if (!crumb || crumb.includes('error')) return null
        cachedCrumb = crumb
        cachedCookies = cookieString
        crumbExpiry = Date.now() + 30 * 60 * 1000
        return { crumb, cookies: cookieString }
    } catch (e) {
        return null
    }
}

async function fetchYahooInsiders(symbol: string, auth: { crumb: string; cookies: string }): Promise<any[]> {
    try {
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=insiderTransactions&crumb=${encodeURIComponent(auth.crumb)}`
        const res = await fetch(url, {
            headers: { ...YAHOO_HEADERS, 'Cookie': auth.cookies },
            next: { revalidate: 300 }
        })
        if (!res.ok) return []
        const data = await res.json()
        return data?.quoteSummary?.result?.[0]?.insiderTransactions?.transactions || []
    } catch (e) {
        return []
    }
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
//  NSE DATA via stock-nse-india package
// ════════════════════════════════════════════════════════════════

async function fetchNSEData(nse: NseIndia, indianTickers: string[]) {
    const events: any[] = []
    const insiders: any[] = []
    const shockers: any[] = []

    const now = Date.now()
    const sevenDaysAgo = new Date(now - 7 * 86400000)
    const ninetyDaysFromNow = new Date(now + 90 * 86400000)
    const oneEightyDaysAgo = new Date(now - 180 * 86400000)

    const BATCH_SIZE = 3
    const BATCH_DELAY = 500

    for (let i = 0; i < indianTickers.length; i += BATCH_SIZE) {
        const batch = indianTickers.slice(i, i + BATCH_SIZE)

        const batchPromises = batch.map(async (ticker) => {
            const nseSymbol = toNSESymbol(ticker)

            // ── 1. TRADE INFO (volume shockers) ──
            try {
                const tradeInfo = await nse.getEquityTradeInfo(nseSymbol)
                const details = await nse.getEquityDetails(nseSymbol)

                const volume = tradeInfo?.marketDeptOrderBook?.tradeInfo?.totalTradedVolume || 0
                const lastPrice = details?.priceInfo?.lastPrice || 0
                const previousClose = details?.priceInfo?.previousClose || 0
                const change = previousClose > 0 ? ((lastPrice - previousClose) / previousClose) * 100 : 0

                if (volume > 0) {
                    // Get average volume from Yahoo (5-day lookback)
                    const yahooTicker = ticker.includes('.') ? ticker : ticker + '.NS'
                    const yahoo = await fetchYahooQuote(yahooTicker)
                    const avgVolume = yahoo?.avgVolume || volume
                    const volumeRatio = avgVolume > 0 ? volume / avgVolume : 0

                    if (volumeRatio > 2.5 && volume > 10000) {
                        shockers.push({
                            ticker: nseSymbol,
                            volume,
                            avgVolume,
                            ratio: volumeRatio.toFixed(1) + 'x',
                            change
                        })
                    }
                }
            } catch (e) { /* skip */ }

            // ── 2. CORPORATE INFO (events + board meetings) ──
            try {
                const corpInfo = await nse.getEquityCorporateInfo(nseSymbol)

                // Corporate Actions (dividends, splits, bonuses, rights)
                const actions = corpInfo?.corporate_actions?.data || []
                actions.forEach((action: any) => {
                    const exDate = parseDate(action.exdate)
                    if (!exDate || exDate < sevenDaysAgo || exDate > ninetyDaysFromNow) return

                    const purpose = (action.purpose || '').toLowerCase()
                    let type = 'Corporate Action'
                    let desc = action.purpose || 'Corporate Action'

                    if (purpose.includes('dividend')) {
                        type = 'Dividend'
                        desc = `Ex-Dividend: ${action.purpose}`
                    } else if (purpose.includes('split') || purpose.includes('sub-division')) {
                        type = 'Split'
                        desc = `Stock Split: ${action.purpose}`
                    } else if (purpose.includes('bonus')) {
                        type = 'Bonus'
                        desc = `Bonus Issue: ${action.purpose}`
                    } else if (purpose.includes('rights')) {
                        type = 'Rights'
                        desc = `Rights Issue: ${action.purpose}`
                    } else if (purpose.includes('buyback')) {
                        type = 'Buyback'
                        desc = `Buyback: ${action.purpose}`
                    }

                    events.push({
                        ticker: nseSymbol,
                        type,
                        date: exDate.toISOString(),
                        desc: desc.length > 80 ? desc.substring(0, 77) + '...' : desc
                    })
                })

                // Board Meetings
                const meetings = corpInfo?.borad_meeting?.data || []
                meetings.forEach((meeting: any) => {
                    const meetingDate = parseDate(meeting.meetingdate)
                    if (!meetingDate || meetingDate < sevenDaysAgo || meetingDate > ninetyDaysFromNow) return

                    events.push({
                        ticker: nseSymbol,
                        type: 'Board Meeting',
                        date: meetingDate.toISOString(),
                        desc: (meeting.purpose || 'Board Meeting').length > 80
                            ? (meeting.purpose || 'Board Meeting').substring(0, 77) + '...'
                            : (meeting.purpose || 'Board Meeting')
                    })
                })

                // Financial Results → treat as "Earnings" events
                const results = corpInfo?.financial_results?.data || []
                results.slice(0, 2).forEach((result: any) => {
                    const toDate = parseDate(result.to_date)
                    if (!toDate || toDate < sevenDaysAgo) return

                    events.push({
                        ticker: nseSymbol,
                        type: 'Earnings',
                        date: toDate.toISOString(),
                        desc: `Results: Income ₹${Number(result.income || 0).toLocaleString('en-IN')}Cr | EPS ₹${result.reDilEPS || 'N/A'}`
                    })
                })
            } catch (e) { /* skip */ }

            // ── 3. INSIDER TRADING (via direct endpoint) ──
            try {
                const insiderData: any = await nse.getDataByEndpoint(
                    `/api/corporates-insider-trading?index=equities&symbol=${encodeURIComponent(nseSymbol)}`
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
                        ticker: nseSymbol,
                        holder: trade.acquirerName || trade.acqName || trade.personName || 'Unknown',
                        relation: trade.personCategory || trade.categoryOfPerson || trade.categoryperson || 'Promoter',
                        action: acqMode || 'Transaction',
                        shares: Math.abs(shares),
                        value: Math.abs(value),
                        date: txnDate.toISOString()
                    })
                })
            } catch (e) { /* skip */ }
        })

        await Promise.all(batchPromises)

        if (i + BATCH_SIZE < indianTickers.length) {
            await delay(BATCH_DELAY)
        }
    }

    return { events, insiders, shockers }
}

// ════════════════════════════════════════════════════════════════
//  YAHOO FALLBACK (when NSE package fails entirely)
// ════════════════════════════════════════════════════════════════

async function fetchYahooFallback(indianTickers: string[]) {
    const events: any[] = []
    const insiders: any[] = []
    const shockers: any[] = []

    const now = Date.now()
    const sevenDaysAgo = new Date(now - 7 * 86400000)
    const ninetyDaysFromNow = new Date(now + 90 * 86400000)
    const oneEightyDaysAgo = new Date(now - 180 * 86400000)

    // ─── Volume + Events (no auth needed) ───
    const promises = indianTickers.map(async (ticker) => {
        const cleanTicker = toNSESymbol(ticker)
        const yahooTicker = ticker.includes('.') ? ticker : ticker + '.NS'

        // Volume from Yahoo chart
        const quote = await fetchYahooQuote(yahooTicker)
        if (quote) {
            if (quote.volumeRatio > 2.5 && quote.volume > 10000) {
                shockers.push({
                    ticker: cleanTicker,
                    volume: quote.volume,
                    avgVolume: quote.avgVolume,
                    ratio: quote.volumeRatio.toFixed(1) + 'x',
                    change: quote.change
                })
            }
        }

        // Events from Yahoo chart (dividends/splits — no auth needed)
        const { dividends, splits } = await fetchYahooEvents(yahooTicker)

        dividends.forEach((div: any) => {
            const date = new Date(div.date * 1000)
            if (date > sevenDaysAgo && date < ninetyDaysFromNow) {
                events.push({
                    ticker: cleanTicker,
                    type: 'Dividend',
                    date: date.toISOString(),
                    desc: `Dividend ₹${div.amount?.toFixed(2) || 'N/A'}`
                })
            }
        })

        splits.forEach((split: any) => {
            const date = new Date(split.date * 1000)
            if (date > sevenDaysAgo && date < ninetyDaysFromNow) {
                events.push({
                    ticker: cleanTicker,
                    type: 'Split',
                    date: date.toISOString(),
                    desc: `Stock Split ${split.numerator}:${split.denominator}`
                })
            }
        })
    })
    await Promise.all(promises)

    // ─── Insider Trading (needs crumb auth) ───
    const auth = await getYahooCrumb()
    if (auth) {
        // Scan all tickers for insider data
        for (const ticker of indianTickers) {
            const cleanTicker = toNSESymbol(ticker)
            const yahooTicker = ticker.includes('.') ? ticker : ticker + '.NS'

            try {
                const txns = await fetchYahooInsiders(yahooTicker, auth)

                txns.forEach((t: any) => {
                    let txnDate: Date | null = null
                    if (t.startDate?.raw) txnDate = new Date(t.startDate.raw * 1000)
                    else if (t.startDate?.fmt) txnDate = new Date(t.startDate.fmt)
                    if (!txnDate || isNaN(txnDate.getTime()) || txnDate < oneEightyDaysAgo) return

                    const shares = t.shares?.raw ?? t.shares ?? 0
                    let value = t.value?.raw ?? t.value ?? 0

                    insiders.push({
                        ticker: cleanTicker,
                        holder: t.filerName || t.name || 'Unknown',
                        relation: t.filerRelation || t.relation || 'N/A',
                        action: t.transactionText || t.text || 'Transaction',
                        shares: Math.abs(shares),
                        value: Math.abs(value),
                        date: txnDate.toISOString()
                    })
                })
            } catch (e) { /* skip this ticker */ }

            // Small delay to avoid rate limiting
            await delay(100)
        }
    } else {
        console.warn('[Pulse] Yahoo crumb auth failed — insider data unavailable')
    }

    return { events, insiders, shockers }
}

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

        // ─── 1. MACRO DATA (always from Yahoo) ───
        const macroPromises = MACRO_TICKERS.map(async (m) => {
            const quote = await fetchYahooQuote(m.symbol)
            if (quote) {
                macro.push({
                    name: m.name,
                    price: quote.price,
                    change: quote.change,
                    type: m.type,
                    prefix: m.prefix,
                    suffix: m.suffix
                })
            }
        })
        await Promise.all(macroPromises)

        // ─── 2. INDIAN STOCK DATA ───
        const indianTickers = uniqueTickers.filter(isIndianStock)
        const nonIndianTickers = uniqueTickers.filter(t => !isIndianStock(t))

        if (indianTickers.length > 0) {
            let nseSuccess = false

            // TRY NSE (via stock-nse-india package - handles cookies/sessions internally)
            try {
                const nse = new NseIndia()
                // Quick connectivity test
                await nse.getEquityDetails('TCS')

                console.log('[Pulse] NSE India connected — fetching data for', indianTickers.length, 'tickers')
                const nseData = await fetchNSEData(nse, indianTickers)
                events.push(...nseData.events)
                insiders.push(...nseData.insiders)
                shockers.push(...nseData.shockers)
                nseSuccess = true
            } catch (e) {
                console.warn('[Pulse] NSE package failed, falling back to Yahoo Finance:', (e as Error).message)
            }

            // FALLBACK to Yahoo if NSE failed
            if (!nseSuccess) {
                const yahooData = await fetchYahooFallback(indianTickers)
                events.push(...yahooData.events)
                insiders.push(...yahooData.insiders)
                shockers.push(...yahooData.shockers)
            }
        }

        // ─── 3. NON-INDIAN TICKERS (Commodities, forex — always Yahoo) ───
        if (nonIndianTickers.length > 0) {
            const nonIndianPromises = nonIndianTickers.map(async (ticker) => {
                const quote = await fetchYahooQuote(ticker)
                if (quote && quote.volumeRatio > 2.5 && quote.volume > 10000) {
                    shockers.push({
                        ticker: ticker.replace('.NS', '').replace('.BO', ''),
                        volume: quote.volume,
                        avgVolume: quote.avgVolume,
                        ratio: quote.volumeRatio.toFixed(1) + 'x',
                        change: quote.change
                    })
                }
            })
            await Promise.all(nonIndianPromises)
        }

        // ─── 4. SORT & DEDUPLICATE ───
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

        const uniqueEvents = events.filter((event, index, self) =>
            index === self.findIndex((e) =>
                e.ticker === event.ticker &&
                e.type === event.type &&
                e.date.split('T')[0] === event.date.split('T')[0]
            )
        )

        const uniqueInsiders = insiders.filter((item, index, self) =>
            index === self.findIndex((e) =>
                e.ticker === item.ticker &&
                e.holder === item.holder &&
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