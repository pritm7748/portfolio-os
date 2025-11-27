// app/api/dividends/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    const fetchAdjustedDividends = async (ticker: string) => {
      try {
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.') && !yahooTicker.includes('-')) {
            yahooTicker = `${yahooTicker}.NS`
        }

        // Fetch 10 Years of Data (Splits + Divs)
        const period1 = Math.floor(Date.now() / 1000) - (10 * 365 * 24 * 60 * 60)
        const period2 = Math.floor(Date.now() / 1000)
        
        // We need TWO calls or one smart call. Yahoo separates events. 
        // Let's fetch charts which usually contain both if we ask nicely, or parse specific endpoints.
        // For v8 API, we can get both in 'events' string? "div|split"
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=div|split`
        
        const response = await fetch(url, { next: { revalidate: 3600 } })
        const data = await response.json()
        const result = data?.chart?.result?.[0]
        
        const events = result?.events || {}
        const dividends = events.dividends || {}
        const splits = events.splits || {}

        // Convert to Arrays
        const divList = Object.values(dividends).map((d: any) => ({
            date: d.date,
            isoDate: new Date(d.date * 1000).toISOString(),
            amount: d.amount,
            originalAmount: d.amount // Keep track of raw
        }))

        const splitList = Object.values(splits).map((s: any) => ({
            date: s.date,
            numerator: s.numerator,
            denominator: s.denominator,
            ratio: s.numerator / s.denominator
        })).sort((a, b) => a.date - b.date) // Sort Oldest to Newest

        // --- THE ADJUSTMENT LOGIC ---
        // We assume the user holds "Current Adjusted Quantity".
        // So we must adjust OLD dividends to be "Per Current Share".
        // If a 10:1 split happened, old dividend of ₹10 should be treated as ₹1.
        
        // We iterate backwards from today. 
        // The Cumulative Split Factor starts at 1.
        // When we hit a split (going backwards), we multiply the factor.
        
        divList.sort((a, b) => b.date - a.date) // Newest first

        let splitFactor = 1
        let splitIndex = splitList.length - 1 // Start from latest split

        // Loop through dividends (Newest -> Oldest)
        for (let i = 0; i < divList.length; i++) {
            const div = divList[i]
            
            // Check if any splits happened AFTER this dividend
            // Since we are going backwards in time, we check if the 'current' split in our list is newer than this dividend
            while (splitIndex >= 0 && splitList[splitIndex].date > div.date) {
                // A split happened AFTER this dividend.
                // Factor updates. E.g., 2:1 Split (Ratio 2). 
                // Old Dividend needs to be divided by 2.
                // So we DIVIDE the amount, or MULTIPLY the divisor.
                splitFactor *= splitList[splitIndex].ratio
                splitIndex--
            }

            // Apply Adjustment
            // If user has 20 shares now (after 2:1 split), and old div was 10.
            // Adjusted Div = 10 / 2 = 5.
            // User gets 20 * 5 = 100. (Correct).
            div.amount = div.amount / splitFactor
        }

        return divList.map(d => ({ date: d.isoDate, amount: d.amount }))

      } catch (e) {
        console.error(`Error ${ticker}`, e)
        return []
      }
    }

    const promises = tickers.map(async (ticker: string) => {
        const history = await fetchAdjustedDividends(ticker)
        return { ticker, history }
    })

    const results = await Promise.all(promises)
    const dividendMap: Record<string, any[]> = {}
    results.forEach(r => {
        if (r.history.length > 0) dividendMap[r.ticker] = r.history
    })

    return NextResponse.json(dividendMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}