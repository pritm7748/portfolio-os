// app/api/pulse/route.ts
import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

// Type definitions for quoteSummary response
type CalendarEvents = {
    earnings?: {
        earningsDate?: Date[]
    }
    exDividendDate?: Date
}

type InsiderTransaction = {
    startDate: Date
    filerName: string
    filerRelation: string
    transactionText: string
    shares: number | { raw: number }
    value: number | { raw: number }
}

type QuoteSummaryResult = {
    calendarEvents?: CalendarEvents
    insiderTransactions?: {
        transactions?: InsiderTransaction[]
    }
}

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()
    
    // 1. Prepare Ticker List
    const uniqueTickers = Array.from(new Set(tickers as string[]))
    const allHoldings = uniqueTickers.map((t) => {
         let clean = t.toUpperCase().trim()
         if (!clean.includes('.') && !clean.includes('^')) clean += '.NS'
         return clean
    })

    const deepScanHoldings = allHoldings

    const events: any[] = []
    const insiders: any[] = []
    const shockers: any[] = []
    const macro: any[] = []
    
    const livePrices: Record<string, number> = {}

    // 2. FETCH QUOTES (Batched)
    const CHUNK_SIZE = 30
    const quoteChunks: string[][] = []
    const symbolsToFetch = [...MACRO_TICKERS.map(m => m.symbol), ...allHoldings]
    
    for (let i = 0; i < symbolsToFetch.length; i += CHUNK_SIZE) {
        quoteChunks.push(symbolsToFetch.slice(i, i + CHUNK_SIZE))
    }

    const chunkResults = await Promise.all(
        quoteChunks.map(async (chunk) => {
            try {
                const results = await yahooFinance.quote(chunk)
                return Array.isArray(results) ? results : [results]
            } catch (err) {
                console.error('Quote fetch error for chunk:', chunk, err)
                return []
            }
        })
    )
    const quoteResults = chunkResults.flat()

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

    // 4. DEEP SCAN (Events & Insiders)
    if (deepScanHoldings.length > 0) {
        await Promise.all(deepScanHoldings.map(async (ticker) => {
            try {
                // ✅ FIX: Cast the result to our defined type
                const result = await yahooFinance.quoteSummary(ticker, { 
                    modules: ['calendarEvents', 'insiderTransactions'] 
                }) as unknown as QuoteSummaryResult

                // Calendar Events
                const cal = result?.calendarEvents
                if (cal?.earnings?.earningsDate) {
                    cal.earnings.earningsDate.forEach((date: Date) => {
                        if (new Date(date) > new Date(Date.now() - 86400000 * 2)) {
                            events.push({ 
                                ticker: ticker.replace('.NS', ''), 
                                type: 'Earnings', 
                                date: date, 
                                desc: 'Earnings' 
                            })
                        }
                    })
                }
                if (cal?.exDividendDate) {
                    if (new Date(cal.exDividendDate) > new Date(Date.now() - 86400000 * 15)) {
                        events.push({ 
                            ticker: ticker.replace('.NS', ''), 
                            type: 'Dividend', 
                            date: cal.exDividendDate, 
                            desc: 'Ex-Dividend' 
                        })
                    }
                }

                // Insider Transactions
                const txns = result?.insiderTransactions?.transactions || []
                txns.forEach((t: InsiderTransaction) => {
                    if (new Date(t.startDate) > new Date(Date.now() - 86400000 * 60)) {
                        
                        // Safe Access for Shares
                        const shares = typeof t.shares === 'object' ? t.shares.raw : (t.shares || 0)
                        
                        // Calculate Value
                        let value = typeof t.value === 'object' ? t.value.raw : (t.value || 0)
                        if (value === 0 && shares > 0) {
                            const currentPrice = livePrices[ticker] || 0
                            value = shares * currentPrice
                        }

                        insiders.push({
                            ticker: ticker.replace('.NS', ''),
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
                console.error(`Deep scan failed for ${ticker}:`, e)
            }
        }))
    }

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

    return NextResponse.json({ events, insiders, shockers, macro })

  } catch (error: any) {
    console.error("Pulse API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}