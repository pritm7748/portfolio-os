// app/api/pulse/route.ts
import { NextResponse } from 'next/server'

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

const NSE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.nseindia.com/',
    'Connection': 'keep-alive',
}

// ════════════════════════════════════════════════════════════════
//  NSE SESSION MANAGEMENT
// ════════════════════════════════════════════════════════════════

let nseCookies: string | null = null
let nseCookieExpiry: number = 0

async function getNSESession(): Promise<string | null> {
    // Return cached cookies if still valid (5 min TTL — NSE sessions expire fast)
    if (nseCookies && Date.now() < nseCookieExpiry) {
        return nseCookies
    }

    try {
        // Visit the NSE homepage to get session cookies
        const res = await fetch('https://www.nseindia.com/', {
            headers: NSE_HEADERS,
            redirect: 'follow',
        })

        if (!res.ok) return null

        const setCookies = res.headers.getSetCookie?.() || []
        const cookieString = setCookies.map(c => c.split(';')[0]).join('; ')

        if (!cookieString) return null

        nseCookies = cookieString
        nseCookieExpiry = Date.now() + 5 * 60 * 1000 // 5 minutes
        return cookieString
    } catch (e) {
        console.error('[NSE] Session init failed:', e)
        return null
    }
}

/** Generic NSE API fetcher with retry */
async function fetchNSE(url: string, cookies: string): Promise<any | null> {
    try {
        const res = await fetch(url, {
            headers: {
                ...NSE_HEADERS,
                'Cookie': cookies,
            },
        })

        // If we get a 401/403, our session expired — clear cache
        if (res.status === 401 || res.status === 403) {
            nseCookies = null
            nseCookieExpiry = 0
            return null
        }

        if (!res.ok) return null

        return await res.json()
    } catch (e) {
        return null
    }
}

// ════════════════════════════════════════════════════════════════
//  NSE DATA FETCHERS
// ════════════════════════════════════════════════════════════════

/** Get live trade info for a stock — volume, OHLC, delivery data */
async function fetchNSETradeInfo(symbol: string, cookies: string) {
    const data = await fetchNSE(
        `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`,
        cookies
    )
    if (!data) return null

    const priceInfo = data.priceInfo || {}
    const tradeInfo = data.securityWiseDP || data.marketDeptOrderBook?.tradeInfo || {}
    const preOpen = data.preOpenMarket?.preopen || []

    const lastPrice = priceInfo.lastPrice || priceInfo.close || 0
    const previousClose = priceInfo.previousClose || 0
    const change = previousClose > 0 ? ((lastPrice - previousClose) / previousClose) * 100 : 0

    // Volume data from trade info
    const totalTradedVolume = tradeInfo.totalTradedVolume || tradeInfo.tradedVolume || 0
    // Use deliverable quantity if available
    const deliverableQty = tradeInfo.deliverableQty || tradeInfo.deliveryToTradedQuantity || 0

    return {
        symbol,
        price: lastPrice,
        previousClose,
        change,
        volume: totalTradedVolume,
        deliverableQty,
        open: priceInfo.open || 0,
        high: priceInfo.intraDayHighLow?.max || priceInfo.weekHighLow?.max || 0,
        low: priceInfo.intraDayHighLow?.min || priceInfo.weekHighLow?.min || 0,
    }
}

/** Get corporate actions (dividends, splits, bonuses, rights) */
async function fetchNSECorporateActions(symbol: string, cookies: string) {
    const data = await fetchNSE(
        `https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=${encodeURIComponent(symbol)}`,
        cookies
    )
    return Array.isArray(data) ? data : []
}

/** Get board meeting dates */
async function fetchNSEBoardMeetings(symbol: string, cookies: string) {
    const data = await fetchNSE(
        `https://www.nseindia.com/api/corporate-board-meetings?index=equities&symbol=${encodeURIComponent(symbol)}`,
        cookies
    )
    return Array.isArray(data) ? data : []
}

/** Get insider trading (SEBI disclosures) */
async function fetchNSEInsiderTrading(symbol: string, cookies: string) {
    const data = await fetchNSE(
        `https://www.nseindia.com/api/corporates-insider-trading?index=equities&symbol=${encodeURIComponent(symbol)}`,
        cookies
    )
    return Array.isArray(data) ? data : []
}

// ════════════════════════════════════════════════════════════════
//  YAHOO FINANCE FETCHERS (kept for macro data + fallback)
// ════════════════════════════════════════════════════════════════

/** Fetch quote data from Yahoo v8 Chart API (no auth needed) */
async function fetchYahooQuote(symbol: string): Promise<any | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
        const res = await fetch(url, {
            headers: YAHOO_HEADERS,
            next: { revalidate: 60 }
        })

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

        return {
            symbol: meta?.symbol || symbol,
            price: currentPrice,
            previousClose,
            change,
            volume: latestVolume,
            avgVolume,
            volumeRatio: avgVolume > 0 ? latestVolume / avgVolume : 0
        }
    } catch (e) {
        return null
    }
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

/** Extract NSE symbol from a ticker like "TCS.NS" → "TCS" */
function toNSESymbol(ticker: string): string {
    return ticker.toUpperCase().replace('.NS', '').replace('.BO', '').replace(':NSE', '').trim()
}

/** Check if a ticker is an Indian stock (not a commodity, forex, or index) */
function isIndianStock(ticker: string): boolean {
    const t = ticker.toUpperCase()
    if (t.includes('^') || t.includes('=')) return false // Indices & forex
    if (t.startsWith('COMMODITY:')) return false
    return true
}

/** Parse a date string in various Indian formats */
function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    // NSE uses formats like "15-Jan-2025", "15 Jan 2025", "2025-01-15"
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    // Try DD-Mon-YYYY format
    const parts = dateStr.split(/[-\/\s]+/)
    if (parts.length === 3) {
        const attempt = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`)
        if (!isNaN(attempt.getTime())) return attempt
    }
    return null
}

/** Small delay to avoid hammering NSE */
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

        // ─── 1. MACRO DATA (Yahoo — global instruments) ───
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

        // ─── 2. INDIAN STOCK DATA (NSE India – all tickers) ───
        const nseCookies = await getNSESession()

        // Separate Indian stocks from non-Indian tickers
        const indianTickers = uniqueTickers.filter(isIndianStock)
        const nonIndianTickers = uniqueTickers.filter(t => !isIndianStock(t))

        const now = Date.now()
        const sixtyDaysAgo = new Date(now - 60 * 86400000)
        const ninetyDaysFromNow = new Date(now + 90 * 86400000)
        const oneEightyDaysAgo = new Date(now - 180 * 86400000)

        if (nseCookies && indianTickers.length > 0) {
            // ─── 2a. Volume Shockers + Events + Insiders from NSE ───
            // Process in batches of 5 to respect rate limits
            const BATCH_SIZE = 5
            const BATCH_DELAY = 300 // ms between batches

            for (let i = 0; i < indianTickers.length; i += BATCH_SIZE) {
                const batch = indianTickers.slice(i, i + BATCH_SIZE)

                const batchPromises = batch.map(async (ticker) => {
                    const nseSymbol = toNSESymbol(ticker)
                    const cleanTicker = nseSymbol // Already clean

                    // ── TRADE INFO (for volume shockers) ──
                    try {
                        const tradeData = await fetchNSETradeInfo(nseSymbol, nseCookies)
                        if (tradeData && tradeData.volume > 0) {
                            // NSE doesn't give us a simple "average volume" — we'll compute
                            // a rough ratio from deliverable quantity vs total volume
                            // For volume shockers, we use total traded volume > some threshold
                            // We'll track this and use Yahoo as supplementary for avg
                            const yahooFallback = await fetchYahooQuote(ticker.includes('.') ? ticker : ticker + '.NS')
                            const avgVolume = yahooFallback?.avgVolume || tradeData.volume
                            const volumeRatio = avgVolume > 0 ? tradeData.volume / avgVolume : 0

                            if (volumeRatio > 2.5 && tradeData.volume > 10000) {
                                shockers.push({
                                    ticker: cleanTicker,
                                    volume: tradeData.volume,
                                    avgVolume: avgVolume,
                                    ratio: volumeRatio.toFixed(1) + 'x',
                                    change: tradeData.change
                                })
                            }
                        }
                    } catch (e) { /* skip */ }

                    // ── CORPORATE ACTIONS (dividends, splits, bonuses) ──
                    try {
                        const actions = await fetchNSECorporateActions(nseSymbol, nseCookies)
                        actions.forEach((action: any) => {
                            const exDate = parseDate(action.exDate || action.exdate)
                            if (!exDate) return
                            if (exDate < sixtyDaysAgo || exDate > ninetyDaysFromNow) return

                            const subject = (action.subject || '').toLowerCase()
                            let type = 'Corporate Action'
                            let desc = action.subject || 'Corporate Action'

                            if (subject.includes('dividend')) {
                                type = 'Dividend'
                                desc = `Ex-Dividend: ${action.subject}`
                            } else if (subject.includes('split') || subject.includes('sub-division')) {
                                type = 'Split'
                                desc = `Stock Split: ${action.subject}`
                            } else if (subject.includes('bonus')) {
                                type = 'Bonus'
                                desc = `Bonus Issue: ${action.subject}`
                            } else if (subject.includes('rights')) {
                                type = 'Rights'
                                desc = `Rights Issue: ${action.subject}`
                            } else if (subject.includes('buyback')) {
                                type = 'Buyback'
                                desc = `Buyback: ${action.subject}`
                            }

                            events.push({
                                ticker: cleanTicker,
                                type,
                                date: exDate.toISOString(),
                                desc: desc.length > 80 ? desc.substring(0, 77) + '...' : desc
                            })
                        })
                    } catch (e) { /* skip */ }

                    // ── BOARD MEETINGS ──
                    try {
                        const meetings = await fetchNSEBoardMeetings(nseSymbol, nseCookies)
                        meetings.forEach((meeting: any) => {
                            const meetingDate = parseDate(meeting.bm_date || meeting.meetingDate)
                            if (!meetingDate) return
                            if (meetingDate < sixtyDaysAgo || meetingDate > ninetyDaysFromNow) return

                            const purpose = meeting.bm_purpose || meeting.purpose || 'Board Meeting'

                            events.push({
                                ticker: cleanTicker,
                                type: 'Board Meeting',
                                date: meetingDate.toISOString(),
                                desc: purpose.length > 80 ? purpose.substring(0, 77) + '...' : purpose
                            })
                        })
                    } catch (e) { /* skip */ }

                    // ── INSIDER TRADING ──
                    try {
                        const trades = await fetchNSEInsiderTrading(nseSymbol, nseCookies)
                        trades.forEach((trade: any) => {
                            const txnDate = parseDate(
                                trade.acqfromDt || trade.date || trade.intimDt || trade.trdDate
                            )
                            if (!txnDate || txnDate < oneEightyDaysAgo) return

                            const shares = Number(trade.secAcq || trade.noOfSecurities || trade.secVal || 0)
                            const value = Number(trade.secVal || trade.tdpTransactionPrice || 0)

                            // Determine action
                            const acqMode = (trade.acqMode || trade.modeOfAcquisition || '').toLowerCase()
                            const txnType = (trade.personCategory || trade.tdpTransactionType || '').toLowerCase()
                            let action = trade.acqMode || trade.transactionType || 'Transaction'

                            // Build proper action string from NSE fields
                            if (acqMode.includes('market') && acqMode.includes('purchase')) action = 'Market Purchase'
                            else if (acqMode.includes('market') && acqMode.includes('sale')) action = 'Market Sale - Disposal'
                            else if (acqMode.includes('off market')) action = 'Off Market Transfer'
                            else if (acqMode.includes('esop') || acqMode.includes('exercise')) action = 'ESOP Exercise'
                            else if (acqMode.includes('pledge')) action = 'Pledge Created'

                            insiders.push({
                                ticker: cleanTicker,
                                holder: trade.acquirerName || trade.personName || trade.acqName || 'Unknown',
                                relation: trade.personCategory || trade.acquirerCategory || trade.categoryperson || 'Promoter',
                                action,
                                shares: Math.abs(shares),
                                value: Math.abs(value),
                                date: txnDate.toISOString()
                            })
                        })
                    } catch (e) { /* skip */ }
                })

                await Promise.all(batchPromises)

                // Delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < indianTickers.length) {
                    await delay(BATCH_DELAY)
                }
            }
        } else if (indianTickers.length > 0) {
            // ─── FALLBACK: Yahoo Finance for Indian stocks if NSE session fails ───
            console.warn('[Pulse] NSE session failed, falling back to Yahoo Finance')

            const holdingPromises = indianTickers.map(async (ticker) => {
                const cleanTicker = toNSESymbol(ticker)
                const yahooTicker = ticker.includes('.') ? ticker : ticker + '.NS'
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
            })
            await Promise.all(holdingPromises)
        }

        // ─── 3. NON-INDIAN TICKERS (Yahoo for commodities, forex) ───
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

        // Deduplicate events (same ticker + type + date)
        const uniqueEvents = events.filter((event, index, self) =>
            index === self.findIndex((e) =>
                e.ticker === event.ticker &&
                e.type === event.type &&
                e.date.split('T')[0] === event.date.split('T')[0]
            )
        )

        // Deduplicate insiders (same ticker + holder + date)
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