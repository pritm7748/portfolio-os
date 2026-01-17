import { NextResponse } from 'next/server'

// --- CONFIGURATION ---
const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

// Helper: Pause execution to be polite to the API
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Helper: Raw Fetcher (Bypasses the library's crumb check)
async function fetchYahooQuotes(symbols: string[]) {
    if (symbols.length === 0) return []
    try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }, // Pretend to be a browser
            next: { revalidate: 0 } // No caching
        })
        if (!res.ok) return []
        const data = await res.json()
        return data?.quoteResponse?.result || []
    } catch (e) {
        console.warn('Raw Quote Fetch Error:', e)
        return []
    }
}

// Helper: Raw Modules Fetcher (For Insiders/Events)
async function fetchYahooModules(symbol: string) {
    try {
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=calendarEvents,insiderTransactions`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 3600 } // Cache these heavy calls for 1 hour
        })
        if (!res.ok) return null
        const data = await res.json()
        return data?.quoteSummary?.result?.[0] || null
    } catch (e) {
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
         // Basic cleanup for Yahoo symbols
         if (!clean.includes('.') && !clean.includes('^') && !clean.includes('=') && !clean.includes('-')) {
             clean += '.NS'
         }
         return clean
    })

    const events: any[] = []
    const insiders: any[] = []
    const shockers: any[] = []
    const macro: any[] = []
    
    const livePrices: Record<string, number> = {}

    // 2. FETCH QUOTES (Batched & Raw)
    const CHUNK_SIZE = 20
    const symbolsToFetch = [...MACRO_TICKERS.map(m => m.symbol), ...allHoldings]
    const quoteResults: any[] = []
    
    // Split into chunks
    const chunks: string[][] = []
    for (let i = 0; i < symbolsToFetch.length; i += CHUNK_SIZE) {
        chunks.push(symbolsToFetch.slice(i, i + CHUNK_SIZE))
    }

    // Execute sequential fetches
    for (const chunk of chunks) {
        const chunkData = await fetchYahooQuotes(chunk)
        quoteResults.push(...chunkData)
        if (chunks.length > 1) await sleep(500) // Small delay between chunks
    }

    // 3. Process Quotes
    quoteResults.forEach((q: any) => {
        if (!q || !q.symbol) return

        livePrices[q.symbol] = q.regularMarketPrice || 0

        // A. Macro
        const macroItem = MACRO_TICKERS.find(m => m.symbol === q.symbol)
        if (macroItem) {
            macro.push({
                name: macroItem.name,
                price: q.regularMarketPrice || 0,
                change: q.regularMarketChangePercent || 0,
                type: macroItem.type,
                prefix: macroItem.prefix,
                suffix: macroItem.suffix
            })
            return
        }

        // B. Volume Shockers
        const vol = q.regularMarketVolume || 0
        const avgVol = q.averageDailyVolume3Month || q.averageDailyVolume10Day || 1
        const ratio = avgVol > 0 ? vol / avgVol : 0
        
        if (ratio > 2.5 && vol > 10000) {
            shockers.push({
                ticker: q.symbol.replace('.NS', ''),
                volume: vol,
                avgVolume: avgVol,
                ratio: ratio.toFixed(1) + 'x',
                change: q.regularMarketChangePercent || 0
            })
        }
    })

    // 4. DEEP SCAN (Using Raw Module Fetcher)
    if (allHoldings.length > 0) {
        const BATCH_LIMIT = 5
        
        for (let i = 0; i < allHoldings.length; i += BATCH_LIMIT) {
            const batch = allHoldings.slice(i, i + BATCH_LIMIT)
            
            await Promise.all(batch.map(async (ticker) => {
                const result = await fetchYahooModules(ticker)
                if (!result) return

                // Calendar Logic
                const cal = result.calendarEvents
                if (cal?.earnings?.earningsDate) {
                    cal.earnings.earningsDate.forEach((d: any) => {
                        const dateStr = d.raw ? new Date(d.raw * 1000) : new Date(d) // Handle yahoo formats
                        if (dateStr > new Date(Date.now() - 86400000 * 2)) {
                            events.push({ ticker: ticker.replace('.NS',''), type: 'Earnings', date: dateStr, desc: `Earnings` })
                        }
                    })
                }
                if (cal?.exDividendDate) {
                    const dateStr = cal.exDividendDate.raw ? new Date(cal.exDividendDate.raw * 1000) : new Date(cal.exDividendDate)
                    if (dateStr > new Date(Date.now() - 86400000 * 15)) {
                        events.push({ ticker: ticker.replace('.NS',''), type: 'Dividend', date: dateStr, desc: 'Ex-Dividend' })
                    }
                }

                // Insiders Logic
                const txns = result.insiderTransactions?.transactions || []
                txns.forEach((t: any) => {
                    const startDate = t.startDate?.raw ? new Date(t.startDate.raw * 1000) : new Date(t.startDate)
                    
                    if (startDate > new Date(Date.now() - 86400000 * 60)) {
                        const shares = t.shares?.raw || t.shares || 0
                        let value = t.value?.raw || t.value || 0
                        
                        // Fallback Value Calc
                        if (value === 0 && shares > 0) {
                            const currentPrice = livePrices[ticker] || 0
                            value = shares * currentPrice
                        }

                        insiders.push({
                            ticker: ticker.replace('.NS',''),
                            holder: t.filerName,
                            relation: t.filerRelation,
                            action: t.transactionText,
                            shares: shares,
                            value: value,
                            date: startDate
                        })
                    }
                })
            }))
            
            if (i + BATCH_LIMIT < allHoldings.length) await sleep(1000)
        }
    }

    // Sort results
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

    return NextResponse.json({ events, insiders, shockers, macro })

  } catch (error: any) {
    console.error("Pulse API Error:", error)
    return NextResponse.json({ events: [], insiders: [], shockers: [], macro: [], error: error.message })
  }
}