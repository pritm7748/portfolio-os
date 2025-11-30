import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // Skip commodities as they don't have standard stock fundamentals
    if (yahooTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 
    
    // Standardize Ticker (Default to NSE if no suffix)
    if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.') && !yahooTicker.includes('=') && !yahooTicker.includes('-')) {
         yahooTicker = `${yahooTicker}.NS`
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`
    
    // CRITICAL FIX: Add User-Agent header to prevent Yahoo 403/404 errors
    const res = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3' },
        next: { revalidate: 300 } // Cache for 5 minutes
    })
    
    const data = await res.json()
    const result = data?.quoteResponse?.result?.[0]

    if (!result) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    return NextResponse.json({
        marketCap: result.marketCap || 0,
        peRatio: result.trailingPE || 0,
        high52: result.fiftyTwoWeekHigh || 0,
        low52: result.fiftyTwoWeekLow || 0,
        divYield: result.dividendYield || result.trailingAnnualDividendYield || 0,
        currency: result.currency || 'INR',
        symbol: result.symbol
    })

  } catch (error: any) {
    console.error("Quote Fetch Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}