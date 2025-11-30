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

    // --- STRATEGY: PARALLEL FETCH ---
    // We fetch from TWO different endpoints to maximize success chance.
    
    // 1. Detailed Quote API (Best for P/E, Market Cap)
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`
    
    // 2. Chart API (Reliable fallback for 52W High/Low if Quote fails)
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`

    const headers = { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9'
    }

    const [quoteRes, chartRes] = await Promise.all([
        fetch(quoteUrl, { headers, next: { revalidate: 300 } }).catch(() => null),
        fetch(chartUrl, { headers, next: { revalidate: 300 } }).catch(() => null)
    ])

    let quoteData = null
    let chartMeta = null

    if (quoteRes && quoteRes.ok) {
        const j = await quoteRes.json()
        quoteData = j?.quoteResponse?.result?.[0]
    }

    if (chartRes && chartRes.ok) {
        const j = await chartRes.json()
        chartMeta = j?.chart?.result?.[0]?.meta
    }

    // If both failed, return error
    if (!quoteData && !chartMeta) {
        console.error(`Both Yahoo endpoints failed for ${yahooTicker}`)
        return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    // --- MERGE DATA ---
    // Prefer Quote Data, fallback to Chart Meta
    const marketCap = quoteData?.marketCap || 0
    const peRatio = quoteData?.trailingPE || quoteData?.forwardPE || 0
    
    // 52 Week Data: Chart Meta is often more reliable for "current" range
    const high52 = quoteData?.fiftyTwoWeekHigh || chartMeta?.fiftyTwoWeekHigh || 0
    const low52 = quoteData?.fiftyTwoWeekLow || chartMeta?.fiftyTwoWeekLow || 0
    
    const divYield = quoteData?.dividendYield || quoteData?.trailingAnnualDividendYield || 0
    const currency = quoteData?.currency || chartMeta?.currency || 'INR'
    const symbol = quoteData?.symbol || chartMeta?.symbol || yahooTicker

    // Final Safety Check: If we have ZERO data points, return 404
    if (marketCap === 0 && peRatio === 0 && high52 === 0) {
         return NextResponse.json({ error: 'Incomplete data' }, { status: 404 })
    }

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
    console.error("Fundamental Fetch Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}