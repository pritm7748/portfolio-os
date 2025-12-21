import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { symbol, interval = '1d', range = '1y' } = await request.json()

    if (!symbol) {
      return NextResponse.json({ error: 'No symbol provided' }, { status: 400 })
    }

    // 1. Resolve Symbol
    let yahooTicker = symbol.toUpperCase().trim()
    
    // Auto-append .NS if no suffix provided (Indian context)
    if (!yahooTicker.includes('.') && !yahooTicker.startsWith('^') && !yahooTicker.includes('=')) {
        yahooTicker += '.NS'
    }

    // 2. Fetch from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data = await res.json()
    const result = data?.chart?.result?.[0]

    if (!result) {
        return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    // 3. Transform Data for Lightweight Charts
    // Yahoo returns parallel arrays. We need to zip them into objects.
    const timestamp = result.timestamp || []
    const quote = result.indicators?.quote?.[0] || {}
    
    const opens = quote.open || []
    const highs = quote.high || []
    const lows = quote.low || []
    const closes = quote.close || []
    const volumes = quote.volume || []

    const candleData = []
    const volumeData = []

    for (let i = 0; i < timestamp.length; i++) {
        // Skip incomplete candles (null values)
        if (opens[i] === null || closes[i] === null) continue

        const time = timestamp[i] // Unix Timestamp (seconds)

        // Candle Series Format
        candleData.push({
            time: time,
            open: opens[i],
            high: highs[i],
            low: lows[i],
            close: closes[i]
        })

        // Volume Series Format (Color coded)
        const isGreen = closes[i] >= opens[i]
        volumeData.push({
            time: time,
            value: volumes[i],
            color: isGreen ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)' // Green/Red with opacity
        })
    }

    return NextResponse.json({ 
        meta: result.meta,
        candles: candleData,
        volume: volumeData 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}