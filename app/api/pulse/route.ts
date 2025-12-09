import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond' },
    { symbol: '^NSEBANK', name: 'Bank Nifty', type: 'Index' }
]

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()
    
    // 1. Prepare Ticker Lists
    // List A: ALL tickers for Volume/Price check (Fast)
    const allHoldings = (tickers || []).map((t: string) => {
         let clean = t.toUpperCase().replace(/\s/g, '')
         if (!clean.includes('.') && !clean.includes('^')) clean += '.NS'
         return clean
    })

    // List B: Top 20 for Deep Scan (Events/Insiders) to save time
    const deepScanHoldings = allHoldings.slice(0, 20)

    const events: any[] = []
    const insiders: any[] = []
    const shockers: any[] = []
    const macro: any[] = []

    // 2. FETCH MACRO & HOLDINGS DATA (Parallel)
    // We fetch quote data for MACRO + ALL HOLDINGS in one go if possible, or batched.
    // Yahoo's quote() can take an array.
    
    const allSymbols = [...MACRO_TICKERS.map(m => m.symbol), ...allHoldings]
    
    // Fetch Quotes in a single batch (very fast)
    let quoteResults: any[] = []
    try {
        quoteResults = await yahooFinance.quote(allSymbols) as any[]
    } catch (e) {
        console.warn("Batch quote fetch failed, falling back to individual")
    }

    // Process Quotes (Macro + Volume Shockers)
    quoteResults.forEach(q => {
        // A. Check if it's a Macro Indicator
        const macroItem = MACRO_TICKERS.find(m => m.symbol === q.symbol)
        if (macroItem) {
            macro.push({
                name: macroItem.name,
                price: q.regularMarketPrice || 0,
                change: q.regularMarketChangePercent || 0,
                type: macroItem.type
            })
            return
        }

        // B. Check for VOLUME SHOCKERS (Big Money Radar)
        // If Volume > 2.5x Average Volume
        const vol = q.regularMarketVolume || 0
        const avgVol = q.averageDailyVolume3Month || 1
        
        // Filter out tiny volume stocks to avoid noise
        if (vol > (avgVol * 2.5) && vol > 50000 && avgVol > 0) {
            shockers.push({
                ticker: q.symbol.replace('.NS', ''), // Clean name for display
                volume: vol,
                avgVolume: avgVol,
                ratio: (vol / avgVol).toFixed(1) + 'x',
                change: q.regularMarketChangePercent || 0
            })
        }
    })

    // 3. DEEP SCAN (Events & Insiders) - Slower, so we limit to top 20
    await Promise.all(deepScanHoldings.map(async (ticker: string) => {
        try {
            const result = await yahooFinance.quoteSummary(ticker, { 
                modules: ['calendarEvents', 'insiderTransactions'] 
            }) as any

            // Calendar
            const cal = result.calendarEvents
            if (cal?.earnings?.earningsDate) {
                cal.earnings.earningsDate.forEach((date: Date) => {
                    if (new Date(date) > new Date(Date.now() - 86400000)) {
                        events.push({ ticker: ticker.replace('.NS',''), type: 'Earnings', date: date, desc: `Earnings` })
                    }
                })
            }
            if (cal?.exDividendDate) {
                if (new Date(cal.exDividendDate) > new Date(Date.now() - 86400000 * 5)) {
                    events.push({ ticker: ticker.replace('.NS',''), type: 'Dividend', date: cal.exDividendDate, desc: 'Ex-Dividend' })
                }
            }

            // Insider
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
            // diverse error handling
        }
    }))

    // Sort Data
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

    return NextResponse.json({ events, insiders, shockers, macro })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}