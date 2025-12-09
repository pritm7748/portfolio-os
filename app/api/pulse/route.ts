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
    
    // 1. Prepare Ticker List (Holdings + Macro)
    const safeHoldings = (tickers || []).slice(0, 15).map((t: string) => {
         let clean = t.toUpperCase().replace(/\s/g, '')
         if (!clean.includes('.') && !clean.includes('^')) clean += '.NS'
         return clean
    })

    const events: any[] = []
    const insiders: any[] = []
    const shockers: any[] = []
    const macro: any[] = []

    // 2. Fetch Macro Data
    await Promise.all(MACRO_TICKERS.map(async (m) => {
        try {
            // FIX: Cast to 'any' to resolve TypeScript 'never' error
            const q = await yahooFinance.quote(m.symbol) as any
            
            if (q) {
                macro.push({
                    name: m.name,
                    price: q.regularMarketPrice || 0,
                    change: q.regularMarketChangePercent || 0,
                    type: m.type
                })
            }
        } catch (e) { console.warn(`Macro fail: ${m.symbol}`, e) }
    }))

    // 3. Process Holdings (Events, Insiders, VOLUME SHOCKERS)
    await Promise.all(safeHoldings.map(async (ticker: string) => {
        try {
            // Fetch Modules + Quote for Volume
            // We use 'as any' here too for safety
            const result = await yahooFinance.quoteSummary(ticker, { 
                modules: ['calendarEvents', 'insiderTransactions', 'price', 'summaryDetail'] 
            }) as any

            // A. Calendar
            const cal = result.calendarEvents
            if (cal?.earnings?.earningsDate) {
                cal.earnings.earningsDate.forEach((date: Date) => {
                    if (new Date(date) > new Date(Date.now() - 86400000 * 2)) {
                        events.push({ ticker, type: 'Earnings', date: date, desc: `Earnings Announcement` })
                    }
                })
            }
            if (cal?.exDividendDate) {
                if (new Date(cal.exDividendDate) > new Date(Date.now() - 86400000 * 30)) {
                    events.push({ ticker, type: 'Dividend', date: cal.exDividendDate, desc: 'Ex-Dividend Date' })
                }
            }

            // B. Insider Transactions
            const txns = result.insiderTransactions?.transactions || []
            txns.forEach((t: any) => {
                 if (new Date(t.startDate) > new Date(Date.now() - 86400000 * 180)) {
                     insiders.push({
                         ticker, holder: t.filerName, relation: t.filerRelation,
                         action: t.transactionText, shares: t.shares.raw, value: t.value.raw, date: t.startDate
                     })
                 }
            })

            // C. VOLUME SHOCKERS (Bulk Deal Proxy)
            // If Volume > 2.5x Average Volume, it's suspicious/big activity
            const vol = result.summaryDetail?.volume?.raw || 0
            const avgVol = result.summaryDetail?.averageVolume?.raw || 1
            if (vol > (avgVol * 2.5) && vol > 100000) {
                shockers.push({
                    ticker,
                    volume: vol,
                    avgVolume: avgVol,
                    ratio: (vol / avgVol).toFixed(1) + 'x',
                    change: result.price?.regularMarketChangePercent?.raw || 0
                })
            }

        } catch (e) {
            console.warn(`Pulse fail for ${ticker}`)
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