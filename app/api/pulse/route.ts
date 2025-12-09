import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

// --- CONFIGURATION UPDATED ---
const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
    // Bank Nifty Removed
]

export async function POST(request: Request) {
  const yahooFinance = new YahooFinance()

  try {
    const { tickers } = await request.json()
    
    // 1. Prepare Ticker List
    const uniqueTickers = Array.from(new Set(tickers as string[]))
    
    const allHoldings = uniqueTickers.map((t) => {
         let clean = t.toUpperCase().trim()
         if (!clean.includes('.') && !clean.includes('^')) {
             clean += '.NS'
         }
         return clean
    })

    const deepScanHoldings = allHoldings

    const events: any[] = []
    const insiders: any[] = []
    const shockers: any[] = []
    const macro: any[] = []

    // 2. FETCH QUOTES (Batched)
    const CHUNK_SIZE = 30
    const quoteChunks = []
    
    const symbolsToFetch = [...MACRO_TICKERS.map(m => m.symbol), ...allHoldings]
    
    for (let i = 0; i < symbolsToFetch.length; i += CHUNK_SIZE) {
        quoteChunks.push(symbolsToFetch.slice(i, i + CHUNK_SIZE))
    }

    const chunkResults = await Promise.all(
        quoteChunks.map(chunk => 
            (yahooFinance.quote(chunk) as Promise<any[]>).catch((e: any) => {
                console.warn("Quote batch failed:", e.message)
                return []
            })
        )
    )
    
    const quoteResults = chunkResults.flat()

    // 3. Process Quotes
    quoteResults.forEach((q: any) => {
        if (!q || !q.symbol) return

        // A. Macro Indicators
        const macroItem = MACRO_TICKERS.find(m => m.symbol === q.symbol)
        if (macroItem) {
            macro.push({
                name: macroItem.name,
                price: q.regularMarketPrice || 0,
                change: q.regularMarketChangePercent || 0,
                type: macroItem.type,
                // Pass formatting info to frontend
                prefix: macroItem.prefix,
                suffix: macroItem.suffix
            })
            return
        }

        // B. VOLUME SHOCKERS
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
    await Promise.all(deepScanHoldings.map(async (ticker) => {
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
                if (new Date(cal.exDividendDate) > new Date(Date.now() - 86400000 * 5)) {
                    events.push({ ticker: ticker.replace('.NS',''), type: 'Dividend', date: cal.exDividendDate, desc: 'Ex-Dividend' })
                }
            }

            // Insiders
            const txns = result.insiderTransactions?.transactions || []
            txns.forEach((t: any) => {
                 if (new Date(t.startDate) > new Date(Date.now() - 86400000 * 90)) {
                     insiders.push({
                         ticker: ticker.replace('.NS',''),
                         holder: t.filerName,
                         relation: t.filerRelation,
                         action: t.transactionText,
                         shares: t.shares.raw,
                         value: t.value.raw,
                         date: t.startDate
                     })
                 }
            })

        } catch (e) {
            // Ignore
        }
    }))

    // Sort Results
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

    return NextResponse.json({ events, insiders, shockers, macro })

  } catch (error: any) {
    console.error("Pulse API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}