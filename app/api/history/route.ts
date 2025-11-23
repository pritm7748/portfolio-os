// app/api/history/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Default to 1 Day, 5 Minute interval for intraday charts
    const { ticker, range = '1d', interval = '5m' } = await request.json()

    if (!ticker) {
      return NextResponse.json({ error: 'No ticker provided' }, { status: 400 })
    }

    // 1. Normalize Ticker
    let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
    if (yahooTicker.startsWith('^')) { 
        // Keep indices as is
    } else if (!yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) {
        yahooTicker = `${yahooTicker}.NS`
    }

    // 2. Fetch Data (1 Day Range)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`
    
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
    })

    if (!response.ok) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

    const data = await response.json()
    const result = data?.chart?.result?.[0]

    if (!result) return NextResponse.json({ error: 'No data found' }, { status: 404 })

    // 3. Clean History Data (Intraday)
    const quote = result.indicators.quote[0]
    const timestamps = result.timestamp

    // Map timestamps to values, filtering out nulls/zeros (common in intraday feeds)
    const history = timestamps.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString(),
        value: quote.close[i]
    })).filter((item: any) => item.value !== null && item.value !== undefined && item.value > 0)

    // 4. Calculate Day's Change Correctly
    const meta = result.meta
    const currentPrice = meta.regularMarketPrice
    
    // For 1d charts, chartPreviousClose is Yesterday's Close. This is the correct baseline.
    const previousClose = meta.chartPreviousClose || meta.previousClose
    
    const change = currentPrice - previousClose
    const changePercent = (change / previousClose) * 100

    return NextResponse.json({
        symbol: meta.symbol,
        currentPrice,
        change,
        changePercent,
        history
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}