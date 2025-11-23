// app/api/prices/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, detailed = false } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    const fetchYahooPrice = async (ticker: string) => {
      try {
        // 1. NORMALIZE TICKER
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')

        if (yahooTicker.startsWith('^')) {
            // Keep as is
        }
        else if (yahooTicker === 'USD-INR' || yahooTicker === 'USDINR') {
            yahooTicker = 'INR=X'
        }
        else if (yahooTicker.includes(':MUTF_IN')) {
            yahooTicker = yahooTicker.split(':')[0] + '.BO'
        }
        else if (yahooTicker.includes('MUTF_IN')) {
             yahooTicker = yahooTicker.replace('MUTF_IN', '.BO')
        }
        else if (!yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) {
            yahooTicker = `${yahooTicker}.NS`
        }
        
        // 2. CALL YAHOO API (1 Day Range to get accurate previous close)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 30 }
        })

        if (!response.ok) return null

        const data = await response.json()
        const result = data?.chart?.result?.[0]
        
        const meta = result?.meta
        if (meta?.regularMarketPrice) {
            const currentPrice = meta.regularMarketPrice
            
            // --- ROBUST CHANGE CALCULATION ---
            // Priority 1: Use Yahoo's previousClose
            // Priority 2: Use chartPreviousClose (Common in v8 API)
            const prevClose = meta.previousClose || meta.chartPreviousClose || currentPrice
            
            const changePercent = ((currentPrice - prevClose) / prevClose) * 100
            
            return { 
                price: currentPrice, 
                change: changePercent 
            }
        }
        return null

      } catch (e) {
        console.error(`Error fetching ${ticker}`, e)
        return null
      }
    }

    const promises = tickers.map(async (ticker: string) => {
        const data = await fetchYahooPrice(ticker)
        return { ticker, data }
    })

    const results = await Promise.all(promises)
    
    const responseMap: Record<string, any> = {}
    
    results.forEach(r => {
        if (r.data) {
            if (detailed) {
                // Detailed Mode (Price + Change) - Used by Market List
                responseMap[r.ticker] = r.data 
            } else {
                // Standard Mode (Price Only) - Used by Holdings/Watchlist
                responseMap[r.ticker] = r.data.price 
            }
        }
    })

    return NextResponse.json(responseMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}