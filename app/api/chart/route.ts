import { NextResponse } from 'next/server'

const SYMBOL_MAP: Record<string, string> = {
    'NIFTY 50': '^NSEI', 'NIFTY': '^NSEI', 'SENSEX': '^BSESN', 
    'BANKNIFTY': '^NSEBANK', 'NIFTY BANK': '^NSEBANK', 'INDIA VIX': '^INDIAVIX'
}

export async function POST(request: Request) {
  try {
    const { symbol, interval = '1d', range = '1y' } = await request.json()
    if (!symbol) return NextResponse.json({ error: 'No symbol' }, { status: 400 })

    let yahooTicker = symbol.toUpperCase().trim()
    if (SYMBOL_MAP[yahooTicker]) yahooTicker = SYMBOL_MAP[yahooTicker]
    else if (yahooTicker.startsWith('COMMODITY:')) {
        if (yahooTicker.includes('GOLD')) yahooTicker = 'GC=F'
        else if (yahooTicker.includes('SILVER')) yahooTicker = 'SI=F'
    }
    else if (!yahooTicker.includes('.') && !yahooTicker.startsWith('^') && !yahooTicker.includes('=')) {
        yahooTicker += '.NS'
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data = await res.json()
    const result = data?.chart?.result?.[0]

    if (!result || !result.timestamp) return NextResponse.json({ candles: [], volume: [] })

    const timestamp = result.timestamp
    const quote = result.indicators?.quote?.[0] || {}
    
    const opens = quote.open || []
    const highs = quote.high || []
    const lows = quote.low || []
    const closes = quote.close || []
    const volumes = quote.volume || []

    const candleData = []
    const volumeData = []
    const usedTimes = new Set()

    for (let i = 0; i < timestamp.length; i++) {
        if (opens[i] === null || closes[i] === null || usedTimes.has(timestamp[i])) continue
        
        const time = timestamp[i]
        usedTimes.add(time)

        candleData.push({
            time: time,
            open: Number(opens[i].toFixed(2)),
            high: Number(highs[i].toFixed(2)),
            low: Number(lows[i].toFixed(2)),
            close: Number(closes[i].toFixed(2))
        })

        const isGreen = closes[i] >= opens[i]
        volumeData.push({
            time: time,
            value: volumes[i] || 0,
            color: isGreen ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'
        })
    }

    candleData.sort((a, b) => a.time - b.time)
    volumeData.sort((a, b) => a.time - b.time)

    return NextResponse.json({ candles: candleData, volume: volumeData })

  } catch (error: any) {
    return NextResponse.json({ error: error.message, candles: [], volume: [] }, { status: 500 })
  }
}