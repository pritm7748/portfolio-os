import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

// Helper to pause execution
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()
    
    // 1. Prepare Ticker List
    const uniqueTickers = Array.from(new Set((tickers || []) as string[]))
    
    const allHoldings = uniqueTickers.map((t) => {
         let clean = t.toUpperCase().trim()
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

    // --- FETCH QUOTES SEQUENTIALLY ---
    const CHUNK_SIZE = 20
    const symbolsToFetch = [...MACRO_TICKERS.map(m => m.symbol), ...allHoldings]
    
    const quoteResults: any[] = []
    // Explicitly typed chunks array
    const chunks: string[][] = [] 

    for (let i = 0; i < symbolsToFetch.length; i += CHUNK_SIZE) {
        chunks.push(symbolsToFetch.slice(i, i + CHUNK_SIZE))
    }

    // Process chunks sequentially
    for (const chunk of chunks) {
        try {
            // FIX: Explicitly cast result to array to fix 'never' error
            const results = await yahooFinance.quote(chunk) as unknown as any[]
            
            if (Array.isArray(results)) {
                quoteResults.push(...results)
            }
            if (chunks.length > 1) await sleep(2000) 
        } catch (e) {
            console.warn(`Failed to fetch chunk: ${chunk[0]}...`, e)
        }
    }

    // Process Quotes
    quoteResults.forEach((q: any) => {
        if (!q || !q.symbol) return

        livePrices[q.symbol] = q.regularMarketPrice || 0

        // Macro
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

        // Volume Shockers
        const vol = q.regularMarketVolume || 0
        const avgVol = q.averageDailyVolume3Month || q.averageDailyVolume10Day || 1
        const ratio = vol / avgVol
        
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

    // --- DEEP SCAN (Events & Insiders) ---
    if (allHoldings.length > 0) {
        const BATCH_LIMIT = 5
        
        for (let i = 0; i < allHoldings.length; i += BATCH_LIMIT) {
            const batch = allHoldings.slice(i, i + BATCH_LIMIT)
            
            await Promise.all(batch.map(async (ticker) => {
                try {
                    const result = await yahooFinance.quoteSummary(ticker, { 
                        modules: ['calendarEvents', 'insiderTransactions'] 
                    }) as any

                    // Calendar
                    const cal = result.calendarEvents
                    if (cal?.earnings?.earningsDate) {
                        cal.earnings.earningsDate.forEach((date: Date) => {
                            if (new Date(date) > new Date(Date.now() - 86400000 * 2)) {
                                events.push({ ticker: ticker.replace('.NS',''), type: 'Earnings', date: date, desc: `Earnings` })
                            }
                        })
                    }
                    if (cal?.exDividendDate) {
                        if (new Date(cal.exDividendDate) > new Date(Date.now() - 86400000 * 15)) {
                            events.push({ ticker: ticker.replace('.NS',''), type: 'Dividend', date: cal.exDividendDate, desc: 'Ex-Dividend' })
                        }
                    }

                    // Insiders
                    const txns = result.insiderTransactions?.transactions || []
                    txns.forEach((t: any) => {
                        if (new Date(t.startDate) > new Date(Date.now() - 86400000 * 60)) {
                            const shares = t.shares?.raw || t.shares || 0
                            let value = t.value?.raw || t.value || 0
                            
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
                                date: t.startDate
                            })
                        }
                    })

                } catch (e) { 
                    // Silent fail
                }
            }))
            
            if (i + BATCH_LIMIT < allHoldings.length) await sleep(1500)
        }
    }

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

    return NextResponse.json({ events, insiders, shockers, macro })

  } catch (error: any) {
    console.error("Pulse API Error:", error)
    return NextResponse.json({ events: [], insiders: [], shockers: [], macro: [], error: error.message })
  }
}