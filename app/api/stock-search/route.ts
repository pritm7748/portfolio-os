import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════
//  /api/stock-search — Yahoo for stocks + MFAPI for mutual funds
//  Both run in parallel with AbortController timeouts
// ════════════════════════════════════════════════════════════════

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// Search Yahoo for stocks & ETFs
async function searchYahoo(q: string): Promise<any[]> {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 2500)
    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-IN&region=IN&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal })
        clearTimeout(timer)
        if (!res.ok) return []
        const data = await res.json()
        return (data.quotes || [])
            .filter((q: any) => q.symbol && q.shortname && q.quoteType !== 'MUTUALFUND')
            .map((q: any) => ({
                symbol: q.symbol.replace('.NS', '').replace('.BO', ''),
                name: q.shortname || q.longname || '',
                exchange: q.exchange || '',
                type: q.quoteType || '',
                yahooSymbol: q.symbol,
            }))
    } catch { clearTimeout(timer); return [] }
}

// Search MFAPI for mutual funds (very fast, lightweight API)
async function searchMFAPI(q: string): Promise<any[]> {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 1500)
    try {
        const url = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal })
        clearTimeout(timer)
        if (!res.ok) return []
        const data = await res.json()
        if (!Array.isArray(data)) return []
        // Only show Direct Growth plans, deduplicate
        const seen = new Set<string>()
        return data
            .filter((s: any) => {
                const name = (s.schemeName || '').toLowerCase()
                return name.includes('direct') && name.includes('growth') && !seen.has(s.schemeCode) && seen.add(s.schemeCode)
            })
            .slice(0, 5)
            .map((s: any) => ({
                symbol: s.schemeCode,
                name: s.schemeName || '',
                exchange: 'MF',
                type: 'MUTUALFUND',
                yahooSymbol: s.schemeCode,
            }))
    } catch { clearTimeout(timer); return [] }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 2) {
        return NextResponse.json({ results: [] })
    }

    try {
        const [stocks, mfs] = await Promise.all([searchYahoo(q), searchMFAPI(q)])
        return NextResponse.json({ results: [...stocks, ...mfs].slice(0, 10) })
    } catch (e: any) {
        console.error('Stock search error:', e.message)
        return NextResponse.json({ results: [] })
    }
}
