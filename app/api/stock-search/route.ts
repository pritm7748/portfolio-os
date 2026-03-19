import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════
//  /api/stock-search — Yahoo Finance autocomplete for stocks & MFs
//  Public endpoint, no API key needed
// ════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 1) {
        return NextResponse.json({ results: [] })
    }

    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-IN&region=IN&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            next: { revalidate: 300 } // Cache for 5 min
        })

        if (!res.ok) {
            console.warn('Yahoo search failed:', res.status)
            return NextResponse.json({ results: [] })
        }

        const data = await res.json()
        const quotes = data.quotes || []

        // Map to clean results — include both stocks & MFs
        const results = quotes
            .filter((q: any) => q.symbol && q.shortname)
            .map((q: any) => ({
                symbol: q.symbol.replace('.NS', '').replace('.BO', ''),
                name: q.shortname || q.longname || '',
                exchange: q.exchange || '',
                type: q.quoteType || '',         // EQUITY, MUTUALFUND, ETF, etc.
                yahooSymbol: q.symbol,            // Keep full Yahoo symbol for MFs
            }))
            .slice(0, 8)

        return NextResponse.json({ results })
    } catch (e: any) {
        console.error('Stock search error:', e.message)
        return NextResponse.json({ results: [] })
    }
}
