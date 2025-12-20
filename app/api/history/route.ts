import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tickers, range = '1y', detailed = false } = await request.json()

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    // --- HELPER: Fetch Raw History ---
    const fetchRawHistory = async (symbol: string, interval: string) => {
        let querySymbol = symbol
        if (symbol === 'GC=F' || symbol === 'SI=F' || symbol === 'INR=X') querySymbol = symbol 
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?range=${range}&interval=${interval}`
        const res = await fetch(url)
        const data = await res.json()
        const result = data?.chart?.result?.[0]
        if (!result) return null
        
        const timestamps = result.timestamp || []
        const closes = result.indicators?.quote?.[0]?.close || []
        
        const map: Record<number, number> = {}
        timestamps.forEach((t: number, i: number) => {
            if (closes[i]) map[t] = closes[i]
        })
        return { map, timestamps, meta: result.meta }
    }

    // --- 1. PRE-FETCH USD/INR HISTORY ---
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

            // Currency Conversion for Commodities
            if (isCommodity && usdinrHistory) {
                let exchangeRate = usdinrHistory[t]
                if (!exchangeRate) {
                    const closestTime = Object.keys(usdinrHistory).find(k => Math.abs(Number(k) - t) < 86400)
                    exchangeRate = closestTime ? usdinrHistory[Number(closestTime)] : 84 
                }

                const OUNCE_TO_GRAM = 31.1035
                const PREMIUM = 1.0625 

                if (commodityType === 'GOLD') {
                    price = (price * exchangeRate / OUNCE_TO_GRAM) * 10 * PREMIUM
                    if (symbol.includes('22')) price = price * 0.916 
                } else if (commodityType === 'SILVER') {
                    price = (price * exchangeRate / OUNCE_TO_GRAM) * 1000 * PREMIUM
                }
            }

            // FIX: Handle Date Formatting based on Range
            const dateObj = new Date(t * 1000)
            const isIntraday = ['1d', '5d'].includes(range)
            
            return {
                // If 1d/5d, preserve time (ISO String). If longer, just Date is fine.
                date: isIntraday ? dateObj.toISOString() : dateObj.toISOString().split('T')[0],
                // FIX: Rename 'price' to 'value' so Recharts can see it
                value: price 
            }
        }).filter(Boolean)

        // --- 4. FORMAT RESPONSE ---
        if (detailed) {
            const meta = rawData.meta || {}
            
            // 1. Get Current Price (Use .value from finalData)
            const currentPrice = finalData.length > 0 ? finalData[finalData.length - 1].value : (meta.regularMarketPrice || 0)
            
            // 2. Get Previous Close
            let previousClose = 0
            if (isCommodity) {
                 if (finalData.length > 1) previousClose = finalData[finalData.length - 2].value
            } else {
                 // Use Meta, fallback to history (.value)
                 previousClose = meta.chartPreviousClose || meta.previousClose || (finalData.length > 1 ? finalData[finalData.length - 2].value : 0)
            }

            // 3. Calculate Change
            const change = currentPrice - previousClose
            const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0
            
            return {
                ticker: symbol,
                currentPrice,
                change,
                changePercent,
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