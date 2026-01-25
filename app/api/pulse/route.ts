// app/api/pulse/route.ts
import { NextResponse } from 'next/server'

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

const BASE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

// Cache for crumb and cookies (module-level for reuse)
let cachedCrumb: string | null = null
let cachedCookies: string | null = null
let crumbExpiry: number = 0

// Helper: Get Yahoo Finance crumb and cookies
async function getYahooCrumb(): Promise<{ crumb: string; cookies: string } | null> {
    // Return cached if still valid (cache for 30 minutes)
    if (cachedCrumb && cachedCookies && Date.now() < crumbExpiry) {
        return { crumb: cachedCrumb, cookies: cachedCookies }
    }

    try {
        // Step 1: Visit Yahoo Finance to get cookies
        const initResponse = await fetch('https://finance.yahoo.com/quote/AAPL', {
            headers: BASE_HEADERS,
            redirect: 'follow'
        })

        if (!initResponse.ok) {
            console.log('[DEBUG] Failed to get initial Yahoo page')
            return null
        }

        // Extract cookies from response
        const setCookies = initResponse.headers.getSetCookie?.() || []
        const cookieString = setCookies
            .map(c => c.split(';')[0])
            .join('; ')

        // Step 2: Get crumb from the crumb endpoint
        const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
            headers: {
                ...BASE_HEADERS,
                'Cookie': cookieString
            }
        })

        if (!crumbResponse.ok) {
            console.log('[DEBUG] Failed to get Yahoo crumb')
            return null
        }

        const crumb = await crumbResponse.text()

        if (!crumb || crumb.includes('error')) {
            console.log('[DEBUG] Invalid crumb received:', crumb)
            return null
        }

        // Cache the values
        cachedCrumb = crumb
        cachedCookies = cookieString
        crumbExpiry = Date.now() + 30 * 60 * 1000 // 30 minutes

        console.log('[DEBUG] Successfully obtained Yahoo crumb')
        return { crumb, cookies: cookieString }

    } catch (e) {
        console.error('[DEBUG] Failed to get Yahoo crumb:', e)
        return null
    }
}

// Helper: Fetch quote data from Yahoo v8 Chart API (no auth needed)
async function fetchQuote(symbol: string): Promise<any | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
        const res = await fetch(url, { 
            headers: BASE_HEADERS, 
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
        console.error(`Quote fetch failed for ${symbol}:`, e)
        return null
    }
}

// Helper: Fetch quoteSummary WITH authentication
async function fetchQuoteSummary(symbol: string, auth: { crumb: string; cookies: string }): Promise<any | null> {
    try {
        const modules = 'calendarEvents,insiderTransactions'
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`
        
        const res = await fetch(url, { 
            headers: {
                ...BASE_HEADERS,
                'Cookie': auth.cookies
            },
            next: { revalidate: 300 } 
        })
        
        if (!res.ok) {
            console.log(`[DEBUG] quoteSummary failed for ${symbol}: HTTP ${res.status}`)
            return null
        }
        
        const data = await res.json()
        const result = data?.quoteSummary?.result?.[0]
        
        if (result) {
            console.log(`[DEBUG] ${symbol} - Available modules:`, Object.keys(result))
        }
        
        return result || null
    } catch (e) {
        console.error(`[DEBUG] QuoteSummary fetch failed for ${symbol}:`, e)
        return null
    }
}

// Alternative: Fetch from Yahoo v8 chart API with events parameter
async function fetchEventsFromChart(symbol: string): Promise<{ dividends: any[], splits: any[] }> {
    try {
        // Fetch 1 year of data with events
        const period1 = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60)
        const period2 = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days future
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div|split|earn`
        
        const res = await fetch(url, { headers: BASE_HEADERS })
        if (!res.ok) return { dividends: [], splits: [] }
        
        const data = await res.json()
        const events = data?.chart?.result?.[0]?.events || {}
        
        const dividends = events.dividends ? Object.values(events.dividends) : []
        const splits = events.splits ? Object.values(events.splits) : []
        
        return { dividends, splits }
    } catch (e) {
        return { dividends: [], splits: [] }
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

        console.log(`[DEBUG] Processing ${allHoldings.length} holdings`)

        const events: any[] = []
        const insiders: any[] = []
        const shockers: any[] = []
        const macro: any[] = []
        const livePrices: Record<string, number> = {}

        // 2. FETCH MACRO DATA (no auth needed)
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

        // 3. FETCH HOLDINGS DATA (Quotes for volume shockers - no auth needed)
        if (allHoldings.length > 0) {
            const holdingPromises = allHoldings.map(async (ticker) => {
                const quote = await fetchQuote(ticker)
                if (quote) {
                    livePrices[ticker] = quote.price

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

        // 4. Get Yahoo authentication for quoteSummary
        const auth = await getYahooCrumb()
        
        if (auth) {
            console.log('[DEBUG] Yahoo auth obtained, fetching events and insiders...')
            
            // Include some US stocks that definitely have insider data
            const testTickers = ['AAPL', 'MSFT', 'NVDA']
            const scanTickers = [...allHoldings.slice(0, 15), ...testTickers]
            
            // Add small delay between requests to avoid rate limiting
            for (const ticker of scanTickers) {
                const summary = await fetchQuoteSummary(ticker, auth)
                if (!summary) continue

                const cleanTicker = ticker.replace('.NS', '').replace('.BO', '')

                // Calendar Events
                const cal = summary.calendarEvents
                if (cal) {
                    // Earnings Dates
                    const earningsDates = cal.earnings?.earningsDate || []
                    earningsDates.forEach((dateObj: any) => {
                        let date: Date | null = null
                        
                        if (dateObj?.raw) {
                            date = new Date(dateObj.raw * 1000)
                        } else if (dateObj?.fmt) {
                            date = new Date(dateObj.fmt)
                        } else if (typeof dateObj === 'string') {
                            date = new Date(dateObj)
                        } else if (typeof dateObj === 'number') {
                            date = new Date(dateObj * 1000)
                        }
                        
                        if (date && !isNaN(date.getTime())) {
                            const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
                            const ninetyDaysFromNow = new Date(Date.now() + 90 * 86400000)
                            
                            if (date > thirtyDaysAgo && date < ninetyDaysFromNow) {
                                events.push({
                                    ticker: cleanTicker,
                                    type: 'Earnings',
                                    date: date.toISOString(),
                                    desc: 'Earnings'
                                })
                                console.log(`[DEBUG] Added earnings event for ${cleanTicker}`)
                            }
                        }
                    })

                    // Ex-Dividend Date
                    let exDivDate: Date | null = null
                    if (cal.exDividendDate?.raw) {
                        exDivDate = new Date(cal.exDividendDate.raw * 1000)
                    } else if (cal.exDividendDate?.fmt) {
                        exDivDate = new Date(cal.exDividendDate.fmt)
                    } else if (cal.exDividendDate) {
                        exDivDate = new Date(cal.exDividendDate)
                    }
                    
                    if (exDivDate && !isNaN(exDivDate.getTime())) {
                        const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
                        const ninetyDaysFromNow = new Date(Date.now() + 90 * 86400000)
                        
                        if (exDivDate > sixtyDaysAgo && exDivDate < ninetyDaysFromNow) {
                            events.push({
                                ticker: cleanTicker,
                                type: 'Dividend',
                                date: exDivDate.toISOString(),
                                desc: 'Ex-Dividend'
                            })
                            console.log(`[DEBUG] Added dividend event for ${cleanTicker}`)
                        }
                    }
                }

                // Insider Transactions
                const txns = summary.insiderTransactions?.transactions || []
                txns.forEach((t: any) => {
                    let txnDate: Date | null = null
                    
                    if (t.startDate?.raw) {
                        txnDate = new Date(t.startDate.raw * 1000)
                    } else if (t.startDate?.fmt) {
                        txnDate = new Date(t.startDate.fmt)
                    } else if (t.startDate) {
                        txnDate = new Date(t.startDate)
                    }
                    
                    if (!txnDate || isNaN(txnDate.getTime())) return

                    const oneEightyDaysAgo = new Date(Date.now() - 180 * 86400000)
                    if (txnDate < oneEightyDaysAgo) return

                    const shares = t.shares?.raw ?? t.shares ?? 0
                    let value = t.value?.raw ?? t.value ?? 0

                    if (value === 0 && shares !== 0) {
                        const currentPrice = livePrices[ticker] || 0
                        value = Math.abs(shares) * currentPrice
                    }

                    insiders.push({
                        ticker: cleanTicker,
                        holder: t.filerName || t.name || 'Unknown',
                        relation: t.filerRelation || t.relation || 'N/A',
                        action: t.transactionText || t.text || 'Transaction',
                        shares: shares,
                        value: value,
                        date: txnDate.toISOString()
                    })
                    console.log(`[DEBUG] Added insider for ${cleanTicker}: ${t.filerName}`)
                })

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        } else {
            console.log('[DEBUG] Yahoo auth failed, trying alternative method for events...')
            
            // Fallback: Get dividend events from chart API (no auth needed)
            const scanTickers = allHoldings.slice(0, 20)
            
            for (const ticker of scanTickers) {
                const { dividends } = await fetchEventsFromChart(ticker)
                const cleanTicker = ticker.replace('.NS', '').replace('.BO', '')
                
                dividends.forEach((div: any) => {
                    const date = new Date(div.date * 1000)
                    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
                    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000)
                    
                    if (date > sixtyDaysAgo && date < thirtyDaysFromNow) {
                        events.push({
                            ticker: cleanTicker,
                            type: 'Dividend',
                            date: date.toISOString(),
                            desc: `Dividend ₹${div.amount?.toFixed(2) || 'N/A'}`
                        })
                    }
                })
            }
        }

        // 5. Sort Results
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

        // 6. Deduplicate events
        const uniqueEvents = events.filter((event, index, self) =>
            index === self.findIndex((e) => 
                e.ticker === event.ticker && 
                e.type === event.type && 
                e.date.split('T')[0] === event.date.split('T')[0]
            )
        )

        console.log(`[DEBUG] Final counts - Events: ${uniqueEvents.length}, Insiders: ${insiders.length}, Shockers: ${shockers.length}, Macro: ${macro.length}`)

        return NextResponse.json({ 
            events: uniqueEvents, 
            insiders: insiders.slice(0, 50),
            shockers: shockers.slice(0, 20),
            macro 
        })

    } catch (error: any) {
        console.error("Pulse API Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}