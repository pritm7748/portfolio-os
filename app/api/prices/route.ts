import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, detailed = false } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    // Helper to fetch raw price from Yahoo
    const fetchRawPrice = async (symbol: string) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
        const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 30 } 
        })
        const data = await res.json()
        return data?.chart?.result?.[0]?.meta?.regularMarketPrice || 0
    }

    const fetchPriceData = async (ticker: string) => {
      try {
        // --- COMMODITY LOGIC (Physical Metal in INR) ---
        if (ticker.startsWith('COMMODITY:')) {
            // 1. Fetch Global Rates (USD)
            const [goldUsd, silverUsd, usdInr] = await Promise.all([
                fetchRawPrice('GC=F'), // Gold Futures (Comex) - USD/Troy Ounce
                fetchRawPrice('SI=F'), // Silver Futures (Comex) - USD/Troy Ounce
                fetchRawPrice('INR=X') // USD to INR Rate
            ])
            
            // Constants
            const OUNCE_TO_GRAM = 31.1035
            
            // Import Duty & Premium Factor (Approx 15% for India)
            // Global Spot * USDINR gives pure metal cost. Indian market adds duty/gst.
            // We add 15% to match MCX/Retail pricing closer.
            const INDIAN_MARKET_PREMIUM = 1.05

            if (ticker === 'COMMODITY:GOLD') {
                // Gold 24K per 10 Grams
                // (USD/oz * INR / 31.1035) * 10 * Premium
                const pureCost = (goldUsd * usdInr / OUNCE_TO_GRAM) * 10
                const marketPrice = pureCost * INDIAN_MARKET_PREMIUM
                return { price: marketPrice, change: 0 }
            }

            if (ticker === 'COMMODITY:GOLD22') {
                // Gold 22K per 10 Grams
                // (24K Price * 0.916)
                const pureCost = (goldUsd * usdInr / OUNCE_TO_GRAM) * 10
                const marketPrice24k = pureCost * INDIAN_MARKET_PREMIUM
                const price22k = marketPrice24k * 0.916
                return { price: price22k, change: 0 }
            }
            
            if (ticker === 'COMMODITY:SILVER') {
                // Silver per 1 KG
                // (USD/oz * INR / 31.1035) * 1000 * Premium
                const pureCost = (silverUsd * usdInr / OUNCE_TO_GRAM) * 1000
                const marketPrice = pureCost * INDIAN_MARKET_PREMIUM
                return { price: marketPrice, change: 0 }
            }
        }

        // --- STANDARD STOCK/MF LOGIC ---
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        
        if (yahooTicker.startsWith('^')) { /* Keep */ }
        else if (yahooTicker === 'USD-INR' || yahooTicker === 'USDINR') yahooTicker = 'INR=X'
        else if (yahooTicker.includes(':MUTF_IN')) yahooTicker = yahooTicker.split(':')[0] + '.BO'
        else if (yahooTicker.includes('MUTF_IN')) yahooTicker = yahooTicker.replace('MUTF_IN', '.BO')
        else if (!yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) yahooTicker = `${yahooTicker}.NS`
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 30 }
        })

        if (!response.ok) return null
        const data = await response.json()
        const meta = data?.chart?.result?.[0]?.meta
        
        if (meta?.regularMarketPrice) {
            const currentPrice = meta.regularMarketPrice
            const prevClose = meta.previousClose || meta.chartPreviousClose || currentPrice
            const changePercent = ((currentPrice - prevClose) / prevClose) * 100
            
            return { price: currentPrice, change: changePercent }
        }
        return null

      } catch (e) {
        console.error(`Error fetching ${ticker}`, e)
        return null
      }
    }

    const promises = tickers.map(async (ticker: string) => {
        const data = await fetchPriceData(ticker)
        return { ticker, data }
    })

    const results = await Promise.all(promises)
    const responseMap: Record<string, any> = {}
    
    results.forEach(r => {
        if (r.data) {
            if (detailed) responseMap[r.ticker] = r.data 
            else responseMap[r.ticker] = r.data.price 
        }
    })

    return NextResponse.json(responseMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}