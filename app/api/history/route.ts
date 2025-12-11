// app/api/history/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, range = '1y', detailed = false } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    // --- HELPER: Fetch Raw History ---
    const fetchRawHistory = async (symbol: string, interval: string) => {
        // Handle special Yahoo tickers (Gold/Silver/USDINR)
        let querySymbol = symbol
        if (symbol === 'GC=F' || symbol === 'SI=F' || symbol === 'INR=X') querySymbol = symbol 
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?range=${range}&interval=${interval}`
        const res = await fetch(url)
        const data = await res.json()
        const result = data?.chart?.result?.[0]
        if (!result) return null
        
        const timestamps = result.timestamp || []
        const closes = result.indicators?.quote?.[0]?.close || []
        
        // Map to efficient object: { "timestamp": price }
        const map: Record<number, number> = {}
        timestamps.forEach((t: number, i: number) => {
            if (closes[i]) map[t] = closes[i]
        })
        return { map, timestamps, meta: result.meta }
    }

    // --- 1. PRE-FETCH USD/INR HISTORY (If needed) ---
    // We fetch this once if any commodity is present to avoid redundant calls
    let usdinrHistory: Record<number, number> | null = null
    const hasCommodity = tickers.some((t: string) => t.startsWith('COMMODITY:'))
    const interval = ['1d', '5d'].includes(range) ? '15m' : '1d'

    if (hasCommodity) {
        const usdData = await fetchRawHistory('INR=X', interval)
        if (usdData) usdinrHistory = usdData.map
    }

    // --- 2. MAIN FETCH LOGIC ---
    const fetchStockHistory = async (symbol: string) => {
        let yahooTicker = symbol.toUpperCase().replace(/\s/g, '')
        let isCommodity = false
        let commodityType = ''

        // Logic to identify Commodities and map to Yahoo Futures
        if (yahooTicker.startsWith('COMMODITY:')) {
            isCommodity = true
            if (yahooTicker.includes('GOLD')) { yahooTicker = 'GC=F'; commodityType = 'GOLD' }
            else if (yahooTicker.includes('SILVER')) { yahooTicker = 'SI=F'; commodityType = 'SILVER' }
        } else {
            if (yahooTicker === '^NSEBANK') yahooTicker = '^NSEBANK'
            else if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.')) yahooTicker += '.NS'
        }

        const rawData = await fetchRawHistory(yahooTicker, interval)
        if (!rawData) return null

        // --- 3. PROCESS & CONVERT ---
        const finalData = rawData.timestamps.map((t: number) => {
            let price = rawData.map[t]
            if (!price) return null

            // *** THE FIX: Currency Conversion for History ***
            if (isCommodity && usdinrHistory) {
                // Find closest matching timestamp in USD/INR history (within 24h buffer)
                // This handles market holidays mismatch between US/India
                let exchangeRate = usdinrHistory[t]
                if (!exchangeRate) {
                    // Simple fallback: look for closest time in the map
                    const closestTime = Object.keys(usdinrHistory).find(k => Math.abs(Number(k) - t) < 86400)
                    exchangeRate = closestTime ? usdinrHistory[Number(closestTime)] : 84 // Absolute fallback
                }

                const OUNCE_TO_GRAM = 31.1035
                const PREMIUM = 1.0625 // Customs + GST + Local Premium

                if (commodityType === 'GOLD') {
                    // Gold 24K (Price per 10g)
                    // Formula: (USD_Price * INR_Rate / 31.1035) * 10 * Premium
                    price = (price * exchangeRate / OUNCE_TO_GRAM) * 10 * PREMIUM
                    
                    // 22K Adjustment
                    if (symbol.includes('22')) price = price * 0.916 
                } else if (commodityType === 'SILVER') {
                    // Silver (Price per 1kg)
                    // Formula: (USD_Price * INR_Rate / 31.1035) * 1000 * Premium
                    price = (price * exchangeRate / OUNCE_TO_GRAM) * 1000 * PREMIUM
                }
            }

            return {
                date: new Date(t * 1000).toISOString().split('T')[0],
                price: price
            }
        }).filter(Boolean)

        // --- 4. FORMAT RESPONSE ---
        if (detailed) {
            const meta = rawData.meta || {}
            const currentPrice = meta.regularMarketPrice || finalData[finalData.length - 1]?.price || 0
            
            return {
                ticker: symbol,
                currentPrice,
                history: finalData
            }
        }

        return {
            ticker: symbol,
            data: finalData
        }
    }

    // Run parallel
    const promises = tickers.map((ticker: string) => fetchStockHistory(ticker))
    const results = await Promise.all(promises)
    
    const historyMap: Record<string, any> = {}
    results.forEach(r => {
        if (r) {
            historyMap[r.ticker] = detailed ? r : r.data
        }
    })

    return NextResponse.json(historyMap)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}