// app/api/search/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) return NextResponse.json([])

  try {
    // We use Yahoo Finance Search (It's fast, free, and covers Indian stocks/MFs)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=6&newsCount=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    )
    
    const data = await response.json()
    
    // Transform data for our frontend
    const results = data.quotes.map((item: any) => ({
        symbol: item.symbol,       // e.g. "TATASTEEL.NS"
        name: item.longname || item.shortname, // e.g. "Tata Steel Limited"
        type: item.quoteType,      // e.g. "EQUITY", "MUTUALFUND", "ETF"
        exch: item.exchange        // e.g. "NSI" (NSE)
    }))

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json([])
  }
}