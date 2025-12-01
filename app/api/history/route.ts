import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, range = '1y' } = await request.json() // range: 1d, 5d, 1mo, 6mo, 1y, 5y, max

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    // Helper to fetch history for one stock
    const fetchStockHistory = async (symbol: string) => {
        // Yahoo Chart API is great for this
        // interval: 1d for long ranges
        const interval = ['1d', '5d'].includes(range) ? '15m' : '1d'
        let yahooTicker = symbol.toUpperCase().replace(/\s/g, '')
        
        // Commodity Logic (simplified for history - tracking raw futures trends)
        if (yahooTicker.startsWith('COMMODITY:')) {
            if (yahooTicker.includes('GOLD')) yahooTicker = 'GC=F'
            else if (yahooTicker.includes('SILVER')) yahooTicker = 'SI=F'
        } else {
            if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.')) yahooTicker += '.NS'
        }

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`
        
        try {
            const res = await fetch(url)
            const data = await res.json()
            const result = data?.chart?.result?.[0]
            
            if (!result) return null

            const timestamps = result.timestamp || []
            const quotes = result.indicators?.quote?.[0] || {}
            const closes = quotes.close || []

            // Map to simple array: { date: '2024-01-01', price: 100 }
            return timestamps.map((t: number, i: number) => ({
                date: new Date(t * 1000).toISOString().split('T')[0],
                price: closes[i] || 0
            })).filter((item: any) => item.price > 0)

        } catch (e) {
            console.error(`History error for ${symbol}`, e)
            return null
        }
    }

    // Run in parallel
    const promises = tickers.map(async (ticker: string) => {
        const history = await fetchStockHistory(ticker)
        return { ticker, history }
    })

    const results = await Promise.all(promises)
    
    // Transform into a map: { "TCS.NS": [ {date, price}, ... ] }
    const historyMap: Record<string, any[]> = {}
    results.forEach(r => {
        if (r.history) historyMap[r.ticker] = r.history
    })

    return NextResponse.json(historyMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}