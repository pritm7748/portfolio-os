import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    if (yahooTicker.startsWith('COMMODITY:')) {
         // Commodities don't have standard fundamentals like P/E
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 
    
    // Standardize
    if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) {
         yahooTicker = `${yahooTicker}.NS`
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`
    const res = await fetch(url, { next: { revalidate: 300 } }) 
    const data = await res.json()
    const result = data?.quoteResponse?.result?.[0]

    if (!result) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    // Return data with fallbacks (0 or null) to prevent UI crash
    return NextResponse.json({
        marketCap: result.marketCap || 0,
        peRatio: result.trailingPE || 0, // ETFs might be 0
        high52: result.fiftyTwoWeekHigh || 0,
        low52: result.fiftyTwoWeekLow || 0,
        divYield: result.dividendYield || result.trailingAnnualDividendYield || 0,
        currency: result.currency || 'INR',
        symbol: result.symbol
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}