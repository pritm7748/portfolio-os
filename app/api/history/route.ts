import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, range = '1y', detailed = false } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    const fetchStockHistory = async (symbol: string) => {
        // --- 1. Original Formatting Logic (Preserved) ---
        const interval = ['1d', '5d'].includes(range) ? '15m' : '1d'
        let yahooTicker = symbol.toUpperCase().replace(/\s/g, '')
        
        if (yahooTicker.startsWith('COMMODITY:')) {
            if (yahooTicker.includes('GOLD')) yahooTicker = 'GC=F'
            else if (yahooTicker.includes('SILVER')) yahooTicker = 'SI=F'
        } else {
            if (yahooTicker === '^NSEBANK') yahooTicker = '^NSEBANK'
            else if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.')) yahooTicker += '.NS'
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

            // --- 2. Branch Logic ---

            // MODE A: Detailed (For Market Cards / Side Panel)
            // Returns: { currentPrice, change, changePercent, history: [...] }
            if (detailed) {
                const meta = result.meta || {}
                const currentPrice = meta.regularMarketPrice || 0
                const previousClose = meta.chartPreviousClose || 0
                const change = currentPrice - previousClose
                const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0

                // Sparkline format (often prefers numbers/values)
                const history = timestamps.map((t: number, i: number) => ({
                    date: t, 
                    value: closes[i] || 0
                })).filter((item: any) => item.value > 0)

                return {
                    ticker: symbol,
                    currentPrice,
                    change,
                    changePercent,
                    history
                }
            }

            // MODE B: Simple (For Portfolio Chart / Calculations)
            // Returns: [{ date: '2024-01-01', price: 100 }, ...]
            // This matches your ORIGINAL code exactly.
            return {
                ticker: symbol,
                data: timestamps.map((t: number, i: number) => ({
                    date: new Date(t * 1000).toISOString().split('T')[0],
                    price: closes[i] || 0
                })).filter((item: any) => item.price > 0)
            }

        } catch (e) {
            console.error(`History error for ${symbol}`, e)
            return null
        }
    }

    // Run in parallel
    const promises = tickers.map((ticker: string) => fetchStockHistory(ticker))
    const results = await Promise.all(promises)
    
    // Construct the response map
    const historyMap: Record<string, any> = {}
    
    results.forEach(r => {
        if (r) {
            if (detailed) {
                // In detailed mode, map the WHOLE object
                historyMap[r.ticker] = r
            } else {
                // In simple mode, map ONLY the data array (Original behavior)
                historyMap[r.ticker] = r.data
            }
        }
    })

    return NextResponse.json(historyMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}