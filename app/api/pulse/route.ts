// app/api/pulse/route.ts
import { NextResponse } from 'next/server'

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
}

// Helper: Fetch quote data from Yahoo v8 Chart API
async function fetchQuote(symbol: string): Promise<any | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
        const res = await fetch(url, { headers: HEADERS, next: { revalidate: 60 } })
        
        if (!res.ok) return null
        
        const data = await res.json()
        const result = data?.chart?.result?.[0]
        if (!result) return null

        const meta = result.meta
        const quotes = result.indicators?.quote?.[0] || {}
        
        // Get latest values
        const currentPrice = meta?.regularMarketPrice || 0
        const previousClose = meta?.chartPreviousClose || meta?.previousClose || 0
        const change = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0
        
        // Volume data
        const volumes = quotes.volume || []
        const latestVolume = volumes[volumes.length - 1] || 0
        
        // Calculate average volume (last 5 days)
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
        console.error(`Quote fetch failed for ${symbol}:`, e)
        return null
    }
}

// Helper: Fetch quoteSummary for events and insiders
async function fetchQuoteSummary(symbol: string): Promise<any | null> {
    try {
        const modules = 'calendarEvents,insiderTransactions'
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`
        const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } })
        
        if (!res.ok) return null
        
        const data = await res.json()
        return data?.quoteSummary?.result?.[0] || null
    } catch (e) {
        console.error(`QuoteSummary fetch failed for ${symbol}:`, e)
        return null
    }
}

export async function POST(request: Request) {
    try {
        const { tickers } = await request.json()

        // 1. Prepare Ticker List
        const uniqueTickers = Array.from(new Set((tickers || []) as string[]))
        const allHoldings = uniqueTickers.map((t) => {
            let clean = t.toUpperCase().trim()
            if (!clean.includes('.') && !clean.includes('^') && !clean.includes('=')) {
                clean += '.NS'
            }
            return clean
        })

        const events: any[] = []
        const insiders: any[] = []
        const shockers: any[] = []
        const macro: any[] = []
        const livePrices: Record<string, number> = {}

        // 2. FETCH MACRO DATA (Always fetch these 4)
        const macroPromises = MACRO_TICKERS.map(async (m) => {
            const quote = await fetchQuote(m.symbol)
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

        // 3. FETCH HOLDINGS DATA (Quotes for volume shockers)
        if (allHoldings.length > 0) {
            const holdingPromises = allHoldings.map(async (ticker) => {
                const quote = await fetchQuote(ticker)
                if (quote) {
                    livePrices[ticker] = quote.price

                    // Check for Volume Shocker (2.5x average)
                    if (quote.volumeRatio > 2.5 && quote.volume > 10000) {
                        shockers.push({
                            ticker: ticker.replace('.NS', '').replace('.BO', ''),
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

        // 4. DEEP SCAN (Events & Insiders) - Limited to first 20 to avoid rate limiting
        const scanTickers = allHoldings.slice(0, 20)
        
        if (scanTickers.length > 0) {
            const summaryPromises = scanTickers.map(async (ticker) => {
                const summary = await fetchQuoteSummary(ticker)
                if (!summary) return

                const cleanTicker = ticker.replace('.NS', '').replace('.BO', '')

                // Calendar Events
                const cal = summary.calendarEvents
                if (cal) {
                    // Earnings Dates
                    const earningsDates = cal.earnings?.earningsDate || []
                    earningsDates.forEach((dateObj: any) => {
                        const date = dateObj?.raw ? new Date(dateObj.raw * 1000) : new Date(dateObj)
                        const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
                        const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000)
                        
                        if (date > twoDaysAgo && date < thirtyDaysFromNow) {
                            events.push({
                                ticker: cleanTicker,
                                type: 'Earnings',
                                date: date.toISOString(),
                                desc: 'Earnings'
                            })
                        }
                    })

                    // Ex-Dividend Date
                    const exDivDate = cal.exDividendDate?.raw 
                        ? new Date(cal.exDividendDate.raw * 1000) 
                        : (cal.exDividendDate ? new Date(cal.exDividendDate) : null)
                    
                    if (exDivDate) {
                        const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000)
                        const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000)
                        
                        if (exDivDate > fifteenDaysAgo && exDivDate < thirtyDaysFromNow) {
                            events.push({
                                ticker: cleanTicker,
                                type: 'Dividend',
                                date: exDivDate.toISOString(),
                                desc: 'Ex-Dividend'
                            })
                        }
                    }
                }

                // Insider Transactions
                const txns = summary.insiderTransactions?.transactions || []
                txns.forEach((t: any) => {
                    // Handle date
                    const txnDate = t.startDate?.raw 
                        ? new Date(t.startDate.raw * 1000) 
                        : (t.startDate ? new Date(t.startDate) : null)
                    
                    if (!txnDate) return

                    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
                    if (txnDate < sixtyDaysAgo) return

                    // Safe extraction of shares and value
                    const shares = t.shares?.raw ?? t.shares ?? 0
                    let value = t.value?.raw ?? t.value ?? 0

                    // Calculate value if missing
                    if (value === 0 && shares !== 0) {
                        const currentPrice = livePrices[ticker] || 0
                        value = Math.abs(shares) * currentPrice
                    }

                    insiders.push({
                        ticker: cleanTicker,
                        holder: t.filerName || 'Unknown',
                        relation: t.filerRelation || 'N/A',
                        action: t.transactionText || 'Transaction',
                        shares: shares,
                        value: value,
                        date: txnDate.toISOString()
                    })
                })
            })
            await Promise.all(summaryPromises)
        }

        // 5. Sort Results
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

        // 6. Deduplicate events (same ticker + same type + same date)
        const uniqueEvents = events.filter((event, index, self) =>
            index === self.findIndex((e) => 
                e.ticker === event.ticker && 
                e.type === event.type && 
                e.date.split('T')[0] === event.date.split('T')[0]
            )
        )

        return NextResponse.json({ 
            events: uniqueEvents, 
            insiders: insiders.slice(0, 50), // Limit to 50 most recent
            shockers: shockers.slice(0, 20), // Limit to top 20
            macro 
        })

    } catch (error: any) {
        console.error("Pulse API Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}