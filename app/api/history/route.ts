import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, range = '1d' } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    const fetchStockData = async (symbol: string) => {
        // 1. Format Ticker for Yahoo
        let yahooTicker = symbol.toUpperCase().replace(/\s/g, '')
        
        // Handle specific cases
        if (yahooTicker === '^NSEBANK') yahooTicker = '^NSEBANK' // Yahoo supports this directly
        else if (yahooTicker.startsWith('^')) { /* keep as is */ }
        else if (!yahooTicker.includes('.')) yahooTicker += '.NS'

        // Interval logic: 1d range needs granular data (5m), longer ranges use 1d
        const interval = ['1d', '5d'].includes(range) ? '5m' : '1d'

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`
        
        try {
            const res = await fetch(url)
            const data = await res.json()
            const result = data?.chart?.result?.[0]
            
            if (!result) return null

            // 2. Extract Price Info from Meta
            const meta = result.meta || {}
            const currentPrice = meta.regularMarketPrice || 0
            const previousClose = meta.chartPreviousClose || 0
            
            // Calculate Change
            const change = currentPrice - previousClose
            const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0

            // 3. Extract History for Sparkline
            const timestamps = result.timestamp || []
            const quotes = result.indicators?.quote?.[0] || {}
            const closes = quotes.close || []

            const history = timestamps.map((t: number, i: number) => ({
                date: t, // Keep as timestamp for easier sorting/charting if needed
                value: closes[i] || 0 // Recharts likes 'value'
            })).filter((item: any) => item.value > 0)

            // Return the exact shape the UI expects
            return {
                ticker: symbol,
                currentPrice,
                change,
                changePercent,
                history
            }

        } catch (e) {
            console.error(`Error fetching ${symbol}`, e)
            return null
        }
    }

    // Run parallel requests
    const promises = tickers.map((t: string) => fetchStockData(t))
    const results = await Promise.all(promises)
    
    // Convert array to Map: { "^NSEI": { ...data } }
    const responseMap: Record<string, any> = {}
    results.forEach(r => {
        if (r) responseMap[r.ticker] = r
    })

    return NextResponse.json(responseMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}