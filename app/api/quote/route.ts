import { NextResponse } from 'next/server'

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

    // Using v7 Quote Endpoint - It is often more reliable for basic stats than v10
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`
    
    console.log(`Fetching fundamentals for: ${yahooTicker}`) // DEBUG LOG

    const res = await fetch(url, { 
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        next: { revalidate: 60 } // Lower cache time to retry failures faster
    })
    
    if (!res.ok) {
        console.error(`Yahoo API Error: ${res.status} ${res.statusText}`)
        return NextResponse.json({ error: `Yahoo API Error: ${res.status}` }, { status: res.status })
    }

    const data = await res.json()
    const result = data?.quoteResponse?.result?.[0]

    if (!result) {
        console.error(`No data found for ticker: ${yahooTicker}`)
        return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    // Extract with fallbacks
    const stats = {
        marketCap: result.marketCap || 0,
        peRatio: result.trailingPE || result.forwardPE || 0,
        high52: result.fiftyTwoWeekHigh || 0,
        low52: result.fiftyTwoWeekLow || 0,
        divYield: result.dividendYield || result.trailingAnnualDividendYield || 0,
        currency: result.currency || 'INR',
        symbol: result.symbol || yahooTicker
    }

    return NextResponse.json(stats)

  } catch (error: any) {
    console.error("Quote Fetch Exception:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}