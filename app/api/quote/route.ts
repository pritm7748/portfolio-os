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

    // 1. FETCH DEEP FUNDAMENTALS (QuoteSummary v10)
    // We request multiple modules to ensure we find the data somewhere
    const modules = ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'price']
    const quoteUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=${modules.join(',')}`
    
    // 2. FETCH CHART (Reliable fallback for 52W High/Low)
    const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`

    const headers = { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
    }

    const [quoteRes, chartRes] = await Promise.all([
        fetch(quoteUrl, { headers, next: { revalidate: 300 } }).catch(() => null),
        fetch(chartUrl, { headers, next: { revalidate: 300 } }).catch(() => null)
    ])

    let q = {} as any
    let c = {} as any

    if (quoteRes && quoteRes.ok) {
        const json = await quoteRes.json()
        const root = json?.quoteSummary?.result?.[0] || {}
        // Merge all modules into one object for easier lookup
        q = { 
            ...root.financialData, 
            ...root.defaultKeyStatistics, 
            ...root.summaryDetail,
            ...root.price 
        }
    }

    if (chartRes && chartRes.ok) {
        const json = await chartRes.json()
        c = json?.chart?.result?.[0]?.meta || {}
    }

    // --- DATA MAPPING WITH FALLBACKS ---
    // Yahoo returns data as objects { raw: 123, fmt: "123" } or direct values. We handle both.

    const getVal = (obj: any, key: string) => {
        if (!obj || !obj[key]) return 0
        return obj[key].raw || obj[key] || 0
    }

    // 1. Market Cap (Try FinancialData -> SummaryDetail -> Price)
    const marketCap = getVal(q, 'marketCap') || c.marketCap || 0

    // 2. P/E Ratio (Try Trailing -> Forward)
    // Note: Some companies have no P/E (losses). This is valid 0.
    const peRatio = getVal(q, 'trailingPE') || getVal(q, 'forwardPE') || 0

    // 3. 52 Week High/Low (Prefer Chart -> Summary)
    const high52 = c.fiftyTwoWeekHigh || getVal(q, 'fiftyTwoWeekHigh') || 0
    const low52 = c.fiftyTwoWeekLow || getVal(q, 'fiftyTwoWeekLow') || 0

    // 4. Dividend Yield
    const divYield = getVal(q, 'dividendYield') || getVal(q, 'trailingAnnualDividendYield') || 0

    // 5. Meta
    const currency = q.currency || c.currency || 'INR'
    const symbol = q.symbol || c.symbol || yahooTicker

    // Final Check: If we missed everything, return 404
    if (marketCap === 0 && high52 === 0) {
         return NextResponse.json({ error: 'Data unavailable' }, { status: 404 })
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
    console.error("Fundamental API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}