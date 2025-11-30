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

    // USE ROBUST v10 ENDPOINT
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=summaryDetail,price`
    
    const res = await fetch(url, { 
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 300 } // Cache 5 mins
    })
    
    if (!res.ok) {
        return NextResponse.json({ error: 'Yahoo API Error' }, { status: res.status })
    }

    const data = await res.json()
    const summary = data?.quoteSummary?.result?.[0]?.summaryDetail
    const price = data?.quoteSummary?.result?.[0]?.price

    if (!summary) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    return NextResponse.json({
        marketCap: summary.marketCap?.raw || 0,
        peRatio: summary.trailingPE?.raw || 0,
        high52: summary.fiftyTwoWeekHigh?.raw || 0,
        low52: summary.fiftyTwoWeekLow?.raw || 0,
        divYield: summary.dividendYield?.raw || summary.trailingAnnualDividendYield?.raw || 0,
        currency: price?.currency || 'INR',
        symbol: price?.symbol || yahooTicker
    })

  } catch (error: any) {
    console.error("Quote Fetch Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}