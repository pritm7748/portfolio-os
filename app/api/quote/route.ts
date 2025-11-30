// app/api/quote/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    // Standardize Ticker for Yahoo
    let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // Handle special cases
    if (yahooTicker.startsWith('COMMODITY:')) {
         // Map to futures for rough data, or return null for fundamentals
         if (yahooTicker.includes('GOLD')) yahooTicker = 'GC=F'
         else if (yahooTicker.includes('SILVER')) yahooTicker = 'SI=F'
    } else {
        // Default to NSE if no suffix
        if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) {
             yahooTicker = `${yahooTicker}.NS`
        }
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`
    const res = await fetch(url, { next: { revalidate: 300 } }) // Cache 5 mins
    const data = await res.json()
    const result = data?.quoteResponse?.result?.[0]

    if (!result) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    return NextResponse.json({
        marketCap: result.marketCap,
        peRatio: result.trailingPE,
        high52: result.fiftyTwoWeekHigh,
        low52: result.fiftyTwoWeekLow,
        divYield: result.dividendYield || result.trailingAnnualDividendYield || 0,
        currency: result.currency,
        symbol: result.symbol
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}