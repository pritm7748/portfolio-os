import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════
//  /api/peer-comparison — Fetch valuation metrics for peer stocks
// ════════════════════════════════════════════════════════════════

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary'
const MODULES = 'financialData,defaultKeyStatistics,summaryDetail'

const safeNum = (v: any, fallback = 0): number => {
    if (v === null || v === undefined) return fallback
    const n = typeof v === 'object' && v.raw !== undefined ? v.raw : Number(v)
    return isNaN(n) ? fallback : n
}

async function fetchPeerData(symbol: string) {
    let ticker = symbol.toUpperCase().replace(/\s/g, '')
    if (!ticker.includes('.')) ticker += '.NS'

    try {
        let res = await fetch(`${YAHOO_BASE}/${encodeURIComponent(ticker)}?modules=${MODULES}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 300 }
        })

        // Fallback to .BO
        if (!res.ok && ticker.endsWith('.NS')) {
            ticker = ticker.replace('.NS', '.BO')
            res = await fetch(`${YAHOO_BASE}/${encodeURIComponent(ticker)}?modules=${MODULES}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 300 }
            })
        }

        if (!res.ok) return null
        const json = await res.json()
        const data = json?.quoteSummary?.result?.[0]
        if (!data) return null

        const fin = data.financialData || {}
        const stats = data.defaultKeyStatistics || {}
        const summary = data.summaryDetail || {}

        return {
            ticker: symbol,
            name: symbol,
            marketCap: safeNum(summary.marketCap),
            peRatio: safeNum(stats.trailingPE),
            pbRatio: safeNum(stats.priceToBook),
            evEbitda: safeNum(stats.enterpriseToEbitda),
            roe: safeNum(fin.returnOnEquity) * 100,
            divYield: safeNum(summary.dividendYield) * 100,
            currentPrice: safeNum(fin.currentPrice) || safeNum(summary.previousClose),
            revenueGrowth: safeNum(fin.revenueGrowth) * 100,
            profitMargin: safeNum(fin.profitMargins) * 100,
            debtToEquity: safeNum(fin.debtToEquity),
            high52: safeNum(summary.fiftyTwoWeekHigh),
            low52: safeNum(summary.fiftyTwoWeekLow),
        }
    } catch {
        return null
    }
}

export async function POST(request: Request) {
    try {
        const { ticker, peers } = await request.json()
        if (!ticker || !peers?.length) {
            return NextResponse.json({ error: 'Ticker and peers required' }, { status: 400 })
        }

        // Fetch all peers in parallel (including the main stock)
        const allSymbols = [ticker, ...peers.slice(0, 7)]
        const results = await Promise.all(allSymbols.map(fetchPeerData))
        const validResults = results.filter(Boolean)

        return NextResponse.json({ comparison: validResults })
    } catch (error: any) {
        console.error('Peer Comparison Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
