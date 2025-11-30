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

    // REQUEST MULTIPLE MODULES TO COVER ALL DATA TYPES
    const modules = ['summaryDetail', 'defaultKeyStatistics', 'price']
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=${modules.join(',')}`
    
    const res = await fetch(url, { 
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 300 } // Cache 5 mins
    })
    
    if (!res.ok) {
        console.error(`Yahoo API Error: ${res.status}`)
        return NextResponse.json({ error: 'Yahoo API Error' }, { status: res.status })
    }

    const data = await res.json()
    const result = data?.quoteSummary?.result?.[0]

    if (!result) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    const summary = result.summaryDetail || {}
    const keyStats = result.defaultKeyStatistics || {}
    const price = result.price || {}

    // ROBUST EXTRACTION WITH FALLBACKS
    const marketCap = summary.marketCap?.raw || price.marketCap?.raw || 0
    const peRatio = summary.trailingPE?.raw || keyStats.trailingPE?.raw || keyStats.forwardPE?.raw || 0
    const high52 = summary.fiftyTwoWeekHigh?.raw || 0
    const low52 = summary.fiftyTwoWeekLow?.raw || 0
    const divYield = summary.dividendYield?.raw || summary.trailingAnnualDividendYield?.raw || 0
    const currency = price.currency || 'INR'
    const symbol = price.symbol || yahooTicker

    return NextResponse.json({
        marketCap,
        peRatio,
        high52,
        low52,
        divYield,
        currency,
        symbol
    })

  } catch (error: any) {
    console.error("Quote Fetch Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}