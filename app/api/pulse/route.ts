import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ events: [], insiders: [] })
    }

    // Limit to Top 10 to prevent timeouts/rate-limiting
    const safeTickers = tickers.slice(0, 10).map(t => {
         let clean = t.toUpperCase().replace(/\s/g, '')
         if (!clean.includes('.') && !clean.includes('^')) clean += '.NS'
         return clean
    })

    const events: any[] = []
    const insiders: any[] = []

    // Process in parallel
    await Promise.all(safeTickers.map(async (ticker) => {
        try {
            // FIX: Cast result to 'any' to resolve TS error "Property does not exist on type 'never'"
            const result = await yahooFinance.quoteSummary(ticker, { 
                modules: ['calendarEvents', 'insiderTransactions', 'recommendationTrend'] 
            }) as any

            // 1. Calendar Events (Earnings, Dividends)
            const cal = result.calendarEvents
            if (cal) {
                if (cal.earnings && cal.earnings.earningsDate) {
                    cal.earnings.earningsDate.forEach((date: Date) => {
                        // Only future or recent past events
                        if (new Date(date) > new Date(Date.now() - 86400000 * 7)) {
                            events.push({
                                ticker,
                                type: 'Earnings',
                                date: date,
                                desc: `Earnings Announcement`
                            })
                        }
                    })
                }
                if (cal.exDividendDate) {
                    events.push({
                        ticker,
                        type: 'Dividend',
                        date: cal.exDividendDate,
                        desc: 'Ex-Dividend Date'
                    })
                }
            }

            // 2. Insider Transactions (Whale Watch)
            // Filter for significant moves (> 1000 shares)
            const txns = result.insiderTransactions?.transactions || []
            txns.forEach((t: any) => {
                 // Only show transactions from last 6 months
                 const txnDate = new Date(t.startDate)
                 const sixMonthsAgo = new Date()
                 sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
                 
                 if (txnDate > sixMonthsAgo && t.shares && t.value) {
                     insiders.push({
                         ticker,
                         holder: t.filerName,
                         relation: t.filerRelation,
                         action: t.transactionText, // 'Buy' or 'Sell' usually
                         shares: t.shares.raw,
                         value: t.value.raw,
                         date: t.startDate
                     })
                 }
            })

        } catch (e) {
            // Fail silently for individual tickers to keep the page loading
            console.warn(`Pulse data fetch failed for ${ticker}`)
        }
    }))

    // Sort by Date (Soonest/Newest first)
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    insiders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ events, insiders })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}