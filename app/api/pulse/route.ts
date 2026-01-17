import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

export async function POST(request: Request) {
  const yahooFinance = new YahooFinance()

  try {
    const { tickers } = await request.json()
    
    // 1. Prepare Ticker List (Handle Empty Case Safely)
    const uniqueTickers = Array.from(new Set((tickers || []) as string[]))
    
    const allHoldings = uniqueTickers.map((t) => {
         let clean = t.toUpperCase().trim()
         // Only add .NS if it looks like a raw Indian ticker (no extension, no caret for indices)
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

    // 2. FETCH QUOTES (Macro + Holdings)
    const CHUNK_SIZE = 30
    const quoteChunks = []
    
    // Always fetch MACRO_TICKERS, even if allHoldings is empty
    const symbolsToFetch = [...MACRO_TICKERS.map(m => m.symbol), ...allHoldings]
    
    for (let i = 0; i < symbolsToFetch.length; i += CHUNK_SIZE) {
        quoteChunks.push(symbolsToFetch.slice(i, i + CHUNK_SIZE))
    }

    const chunkResults = await Promise.all(
        quoteChunks.map(chunk => 
            (yahooFinance.quote(chunk) as Promise<any[]>).catch(e => {
                console.warn("Quote chunk failed", e)
                return []
            })
        )
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

        // B. Volume Shockers (Only for holdings)
        const vol = q.regularMarketVolume || 0
        const avgVol = q.averageDailyVolume3Month || q.averageDailyVolume10Day || 1
        const ratio = vol / avgVol
        
        // Threshold: 2.5x Volume AND significant volume (>10k)
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

    // 4. DEEP SCAN (Events & Insiders) - Only if we have holdings
    if (allHoldings.length > 0) {
        await Promise.all(allHoldings.map(async (ticker) => {
            try {
                const result = await yahooFinance.quoteSummary(ticker, { 
                    modules: ['calendarEvents', 'insiderTransactions'] 
                }) as any

                // Calendar
                const cal = result.calendarEvents
                if (cal?.earnings?.earningsDate) {
                    cal.earnings.earningsDate.forEach((date: Date) => {
                        // Show earnings from last 2 days to future
                        if (new Date(date) > new Date(Date.now() - 86400000 * 2)) {
                            events.push({ ticker: ticker.replace('.NS',''), type: 'Earnings', date: date, desc: `Earnings` })
                        }
                    })
                }
                if (cal?.exDividendDate) {
                    // Show dividends from last 15 days (to catch recent ex-dates)
                    if (new Date(cal.exDividendDate) > new Date(Date.now() - 86400000 * 15)) {
                        events.push({ ticker: ticker.replace('.NS',''), type: 'Dividend', date: cal.exDividendDate, desc: 'Ex-Dividend' })
                    }
                }

                // Insiders
                const txns = result.insiderTransactions?.transactions || []
                txns.forEach((t: any) => {
                    // Last 60 days
                    if (new Date(t.startDate) > new Date(Date.now() - 86400000 * 60)) {
                        
                        const shares = t.shares?.raw || t.shares || 0
                        let value = t.value?.raw || t.value || 0
                        
                        // Fallback value calculation
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
                // Ignore individual failures
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