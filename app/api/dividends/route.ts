// app/api/dividends/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    const fetchDividendHistory = async (ticker: string) => {
      try {
        // 1. Normalize Ticker
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.') && !yahooTicker.includes('-')) {
            yahooTicker = `${yahooTicker}.NS`
        }

        // 2. Fetch 5 Years of Data with 'events=div'
        // period1=0 means "from the beginning" (or effectively a long time ago)
        // period2 is now.
        const period1 = Math.floor(Date.now() / 1000) - (5 * 365 * 24 * 60 * 60) // 5 years ago
        const period2 = Math.floor(Date.now() / 1000)
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=div`
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 3600 } // Cache for 1 hour
        })

        if (!response.ok) return null

        const data = await response.json()
        const result = data?.chart?.result?.[0]
        
        // 3. Extract Dividends
        const dividendsObj = result?.events?.dividends
        if (!dividendsObj) return []

        // Convert object { "16987654": { amount: 10, date: ... } } to Array
        const dividendList = Object.values(dividendsObj).map((d: any) => ({
            date: new Date(d.date * 1000).toISOString(), // Yahoo sends seconds
            amount: d.amount
        }))

        return dividendList

      } catch (e) {
        console.error(`Error fetching dividends for ${ticker}`, e)
        return []
      }
    }

    // Run in parallel
    const promises = tickers.map(async (ticker: string) => {
        const history = await fetchDividendHistory(ticker)
        return { ticker, history }
    })

    const results = await Promise.all(promises)
    
    const dividendMap: Record<string, any[]> = {}
    results.forEach(r => {
        if (r.history && r.history.length > 0) {
            dividendMap[r.ticker] = r.history
        }
    })

    return NextResponse.json(dividendMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}