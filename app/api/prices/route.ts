import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, detailed = false } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    // Helper: Fetch Price AND Previous Close
    const fetchQuote = async (symbol: string) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
        const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 30 } 
        })
        const data = await res.json()
        const meta = data?.chart?.result?.[0]?.meta
        return {
            price: meta?.regularMarketPrice || 0,
            prev: meta?.chartPreviousClose || meta?.previousClose || 0
        }
    }

    const fetchPriceData = async (ticker: string) => {
      try {
        // --- COMMODITY LOGIC (With Day Change) ---
        if (ticker.startsWith('COMMODITY:')) {
            const [gold, silver, usd] = await Promise.all([
                fetchQuote('GC=F'), // Gold Futures
                fetchQuote('SI=F'), // Silver Futures
                fetchQuote('INR=X') // USD/INR
            ])
            
            const OUNCE_TO_GRAM = 31.1035
            const INDIAN_MARKET_PREMIUM = 1.075 // 5% Buffer

            let current = 0
            let prev = 0

            if (ticker === 'COMMODITY:GOLD') {
                // Gold 24K per 10 Grams
                current = (gold.price * usd.price / OUNCE_TO_GRAM) * 10 * INDIAN_MARKET_PREMIUM
                // Calculate yesterday's INR price too for accurate change %
                prev = (gold.prev * usd.prev / OUNCE_TO_GRAM) * 10 * INDIAN_MARKET_PREMIUM
            } 
            else if (ticker === 'COMMODITY:GOLD22') {
                // Gold 22K per 10 Grams
                current = (gold.price * usd.price / OUNCE_TO_GRAM) * 10 * INDIAN_MARKET_PREMIUM * 0.916
                prev = (gold.prev * usd.prev / OUNCE_TO_GRAM) * 10 * INDIAN_MARKET_PREMIUM * 0.916
            } 
            else if (ticker === 'COMMODITY:SILVER') {
                // Silver per 1 KG
                current = (silver.price * usd.price / OUNCE_TO_GRAM) * 1000 * INDIAN_MARKET_PREMIUM
                prev = (silver.prev * usd.prev / OUNCE_TO_GRAM) * 1000 * INDIAN_MARKET_PREMIUM
            }

            const changePercent = prev > 0 ? ((current - prev) / prev) * 100 : 0
            
            return { price: current, change: changePercent }
        }

        // --- STANDARD STOCK/MF LOGIC ---
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        
        if (yahooTicker.startsWith('^')) { /* Keep */ }
        else if (yahooTicker === 'USD-INR' || yahooTicker === 'USDINR') yahooTicker = 'INR=X'
        else if (yahooTicker.includes(':MUTF_IN')) yahooTicker = yahooTicker.split(':')[0] + '.BO'
        else if (yahooTicker.includes('MUTF_IN')) yahooTicker = yahooTicker.replace('MUTF_IN', '.BO')
        else if (!yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) yahooTicker = `${yahooTicker}.NS`
        
        const quote = await fetchQuote(yahooTicker)
        
        if (quote.price) {
            const changePercent = quote.prev > 0 ? ((quote.price - quote.prev) / quote.prev) * 100 : 0
            return { price: quote.price, change: changePercent }
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