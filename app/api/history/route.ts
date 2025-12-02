import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // 1. Check for the 'detailed' flag
    const { tickers, range = '1d', detailed = false } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    const fetchStockHistory = async (symbol: string) => {
        let yahooTicker = symbol.toUpperCase().replace(/\s/g, '')
        
        // Formatting logic
        if (yahooTicker === '^NSEBANK') yahooTicker = '^NSEBANK'
        else if (yahooTicker.startsWith('^')) { /* keep as is */ }
        else if (!yahooTicker.includes('.')) yahooTicker += '.NS'

        // Interval logic
        const interval = ['1d', '5d'].includes(range) ? '5m' : '1d'

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`
        
        try {
            const res = await fetch(url)
            const data = await res.json()
            const result = data?.chart?.result?.[0]
            
            if (!result) return null

            // Extract History (Common to both modes)
            const timestamps = result.timestamp || []
            const quotes = result.indicators?.quote?.[0] || {}
            const closes = quotes.close || []

            const history = timestamps.map((t: number, i: number) => ({
                date: t, // Keep as timestamp
                value: closes[i] || 0
            })).filter((item: any) => item.value > 0)

            // --- MODE A: Detailed (For Market Cards) ---
            if (detailed) {
                const meta = result.meta || {}
                const currentPrice = meta.regularMarketPrice || 0
                const previousClose = meta.chartPreviousClose || 0
                const change = currentPrice - previousClose
                const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0
                
                return {
                    ticker: symbol,
                    type: 'detailed',
                    data: {
                        currentPrice,
                        change,
                        changePercent,
                        history
                    }
                }
            } 
            
            // --- MODE B: Simple (For Portfolio Chart) ---
            // Restores the original array format
            return {
                ticker: symbol,
                type: 'simple',
                data: history 
            }

        } catch (e) {
            console.error(`History error for ${symbol}`, e)
            return null
        }
    }

    const promises = tickers.map((t: string) => fetchStockHistory(t))
    const results = await Promise.all(promises)
    
    // Construct the response map
    const responseMap: Record<string, any> = {}
    
    results.forEach(r => {
        if (r) {
            // Map the ticker to the specific data format returned above
            responseMap[r.ticker] = r.data
        }
    })

    return NextResponse.json(responseMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}