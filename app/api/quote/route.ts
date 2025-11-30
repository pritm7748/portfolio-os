import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // Skip commodities
    if (yahooTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 
    
    // Standardize Ticker
    if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) {
         yahooTicker = `${yahooTicker}.NS`
    }

    try {
        // 1. Fetch Data with Library
        // We cast to 'any' to prevent TypeScript issues with the dynamic response structure
        const result = await yahooFinance.quoteSummary(yahooTicker, { 
            modules: ["summaryDetail", "defaultKeyStatistics", "price"] 
        }) as any

        const summary = result.summaryDetail || {}
        const keyStats = result.defaultKeyStatistics || {}
        const price = result.price || {}

        return NextResponse.json({
            marketCap: summary.marketCap || price.marketCap || 0,
            peRatio: summary.trailingPE || keyStats.trailingPE || keyStats.forwardPE || 0,
            high52: summary.fiftyTwoWeekHigh || 0,
            low52: summary.fiftyTwoWeekLow || 0,
            divYield: summary.dividendYield || summary.trailingAnnualDividendYield || 0,
            currency: price.currency || 'INR',
            symbol: price.symbol || yahooTicker
        })

    } catch (libError: any) {
        console.warn(`Library fetch failed for ${yahooTicker}, trying fallback...`)
        
        // 2. Fallback: Raw Chart API (Gets Price/High/Low, but NO P/E)
        // This runs if the library fails (e.g. blocked, or ticker invalid)
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`
        const res = await fetch(chartUrl)
        const data = await res.json()
        const meta = data?.chart?.result?.[0]?.meta

        if (!meta) {
             return NextResponse.json({ error: 'Data not found' }, { status: 404 })
        }

        return NextResponse.json({
            marketCap: 0,
            peRatio: 0,
            high52: meta.fiftyTwoWeekHigh || 0,
            low52: meta.fiftyTwoWeekLow || 0,
            divYield: 0,
            currency: meta.currency || 'INR',
            symbol: meta.symbol || yahooTicker
        })
    }

  } catch (error: any) {
    console.error("Quote Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}