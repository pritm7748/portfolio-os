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

// Helper: Fetch quoteSummary for events and insiders
async function fetchQuoteSummary(symbol: string): Promise<any | null> {
    try {
        // Try multiple module combinations
        const modules = 'calendarEvents,insiderTransactions,insiderHolders,institutionOwnership'
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`
        
        console.log(`[DEBUG] Fetching quoteSummary for: ${symbol}`)
        
        const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } })
        
        if (!res.ok) {
            console.log(`[DEBUG] quoteSummary failed for ${symbol}: HTTP ${res.status}`)
            return null
        }
        
        const data = await res.json()
        const result = data?.quoteSummary?.result?.[0]
        
        // Debug: Log what we received
        if (result) {
            console.log(`[DEBUG] ${symbol} - Available modules:`, Object.keys(result))
            
            if (result.calendarEvents) {
                console.log(`[DEBUG] ${symbol} - calendarEvents:`, JSON.stringify(result.calendarEvents, null, 2))
            }
            
            if (result.insiderTransactions) {
                const txnCount = result.insiderTransactions?.transactions?.length || 0
                console.log(`[DEBUG] ${symbol} - insiderTransactions count: ${txnCount}`)
                if (txnCount > 0) {
                    console.log(`[DEBUG] ${symbol} - First insider txn:`, JSON.stringify(result.insiderTransactions.transactions[0], null, 2))
                }
            }
        } else {
            console.log(`[DEBUG] ${symbol} - No result in quoteSummary response`)
        }
        
        return result || null
    } catch (e) {
        console.error(`[DEBUG] QuoteSummary fetch failed for ${symbol}:`, e)
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

        console.log(`[DEBUG] Processing ${allHoldings.length} holdings:`, allHoldings)

        const events: any[] = []
        const insiders: any[] = []
        const shockers: any[] = []
        const macro: any[] = []
        const livePrices: Record<string, number> = {}

        // 2. FETCH MACRO DATA
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

        // 4. DEEP SCAN (Events & Insiders)
        // Also add some known US stocks that DEFINITELY have data for testing
        const testTickers = ['AAPL', 'MSFT', 'GOOGL'] // These will have insider data
        const scanTickers = [...allHoldings.slice(0, 15), ...testTickers]
        
        console.log(`[DEBUG] Deep scanning ${scanTickers.length} tickers for events/insiders`)

        if (scanTickers.length > 0) {
            const summaryPromises = scanTickers.map(async (ticker) => {
                const summary = await fetchQuoteSummary(ticker)
                if (!summary) return

                const cleanTicker = ticker.replace('.NS', '').replace('.BO', '')

                // Calendar Events - RELAXED DATE FILTERING
                const cal = summary.calendarEvents
                if (cal) {
                    // Earnings Dates
                    const earningsDates = cal.earnings?.earningsDate || []
                    console.log(`[DEBUG] ${ticker} - Earnings dates found: ${earningsDates.length}`)
                    
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
                            // RELAXED: Show events from 30 days ago to 90 days in future
                            const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
                            const ninetyDaysFromNow = new Date(Date.now() + 90 * 86400000)
                            
                            if (date > thirtyDaysAgo && date < ninetyDaysFromNow) {
                                events.push({
                                    ticker: cleanTicker,
                                    type: 'Earnings',
                                    date: date.toISOString(),
                                    desc: 'Earnings'
                                })
                                console.log(`[DEBUG] Added earnings event for ${cleanTicker}: ${date.toISOString()}`)
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
                        // RELAXED: Show dividends from 60 days ago to 90 days in future
                        const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
                        const ninetyDaysFromNow = new Date(Date.now() + 90 * 86400000)
                        
                        if (exDivDate > sixtyDaysAgo && exDivDate < ninetyDaysFromNow) {
                            events.push({
                                ticker: cleanTicker,
                                type: 'Dividend',
                                date: exDivDate.toISOString(),
                                desc: 'Ex-Dividend'
                            })
                            console.log(`[DEBUG] Added dividend event for ${cleanTicker}: ${exDivDate.toISOString()}`)
                        }
                    }
                }

                // Insider Transactions - RELAXED DATE FILTERING
                const txns = summary.insiderTransactions?.transactions || []
                console.log(`[DEBUG] ${ticker} - Insider transactions found: ${txns.length}`)
                
                txns.forEach((t: any) => {
                    // Handle date parsing
                    let txnDate: Date | null = null
                    
                    if (t.startDate?.raw) {
                        txnDate = new Date(t.startDate.raw * 1000)
                    } else if (t.startDate?.fmt) {
                        txnDate = new Date(t.startDate.fmt)
                    } else if (t.startDate) {
                        txnDate = new Date(t.startDate)
                    }
                    
                    if (!txnDate || isNaN(txnDate.getTime())) return

                    // RELAXED: Show transactions from last 180 days
                    const oneEightyDaysAgo = new Date(Date.now() - 180 * 86400000)
                    if (txnDate < oneEightyDaysAgo) return

                    // Safe extraction of shares and value
                    const shares = t.shares?.raw ?? t.shares ?? 0
                    let value = t.value?.raw ?? t.value ?? 0

                    // Calculate value if missing
                    if (value === 0 && shares !== 0) {
                        const currentPrice = livePrices[ticker] || 0
                        value = Math.abs(shares) * currentPrice
                    }

                    const insiderEntry = {
                        ticker: cleanTicker,
                        holder: t.filerName || t.name || 'Unknown',
                        relation: t.filerRelation || t.relation || 'N/A',
                        action: t.transactionText || t.text || 'Transaction',
                        shares: shares,
                        value: value,
                        date: txnDate.toISOString()
                    }
                    
                    insiders.push(insiderEntry)
                    console.log(`[DEBUG] Added insider transaction for ${cleanTicker}:`, insiderEntry)
                })
            })
            await Promise.all(summaryPromises)
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