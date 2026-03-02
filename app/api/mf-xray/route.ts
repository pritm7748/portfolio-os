// app/api/mf-xray/route.ts
import { NextResponse } from 'next/server'

const YAHOO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.5',
}

interface HoldingItem {
    name: string
    weight: number   // 0-100
    symbol?: string
}

interface SectorItem {
    sector: string
    weight: number   // 0-100
}

interface FundXray {
    ticker: string
    fundName: string
    holdings: HoldingItem[]
    sectorWeights: SectorItem[]
    equityPercent: number
    bondPercent: number
    error?: string
}

async function fetchTopHoldings(ticker: string): Promise<FundXray> {
    const result: FundXray = {
        ticker,
        fundName: ticker,
        holdings: [],
        sectorWeights: [],
        equityPercent: 0,
        bondPercent: 0,
    }

    try {
        // Try Yahoo quoteSummary with topHoldings module
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=topHoldings,assetProfile`
        const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 86400 } }) // cache 24h

        if (!res.ok) {
            result.error = `Yahoo returned ${res.status}`
            return result
        }

        const data = await res.json()
        const quoteSummary = data?.quoteSummary?.result?.[0]

        if (!quoteSummary) {
            result.error = 'No data from Yahoo'
            return result
        }

        const topHoldings = quoteSummary.topHoldings
        const assetProfile = quoteSummary.assetProfile

        // Fund name
        if (assetProfile?.longBusinessSummary) {
            result.fundName = assetProfile.longBusinessSummary.substring(0, 100)
        }

        if (!topHoldings) {
            result.error = 'No topHoldings data'
            return result
        }

        // Stock holdings
        const holdings = topHoldings.holdings || []
        result.holdings = holdings.map((h: any) => ({
            name: h.holdingName || h.symbol || 'Unknown',
            weight: (h.holdingPercent?.raw || 0) * 100,
            symbol: h.symbol || undefined,
        }))

        // Sector weightings
        const sectorWeightings = topHoldings.sectorWeightings || []
        result.sectorWeights = sectorWeightings.flatMap((sw: any) => {
            return Object.entries(sw).map(([sector, val]: [string, any]) => ({
                sector: formatSectorName(sector),
                weight: (val?.raw || 0) * 100,
            }))
        })

        // Equity/bond split
        result.equityPercent = (topHoldings.equityHoldings?.priceToEarnings?.raw || 0) > 0 ? 100 : 0
        const stockPosition = topHoldings.stockPosition?.raw
        const bondPosition = topHoldings.bondPosition?.raw
        if (stockPosition !== undefined) result.equityPercent = stockPosition * 100
        if (bondPosition !== undefined) result.bondPercent = bondPosition * 100

    } catch (e: any) {
        result.error = e?.message || 'Fetch failed'
    }

    return result
}

function formatSectorName(key: string): string {
    // Convert camelCase like "realestate" or "technology" to readable form
    const map: Record<string, string> = {
        realestate: 'Real Estate',
        consumer_cyclical: 'Consumer Cyclical',
        basic_materials: 'Basic Materials',
        consumer_defensive: 'Consumer Defensive',
        technology: 'Technology',
        communication_services: 'Communication Services',
        financial_services: 'Financial Services',
        utilities: 'Utilities',
        industrials: 'Industrials',
        energy: 'Energy',
        healthcare: 'Healthcare',
    }
    return map[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

export async function POST(request: Request) {
    try {
        const { tickers } = await request.json()

        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
        }

        // Process in batches of 3 to be gentle on Yahoo
        const results: FundXray[] = []
        const BATCH = 3
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

        for (let i = 0; i < tickers.length; i += BATCH) {
            const batch = tickers.slice(i, i + BATCH)
            const batchResults = await Promise.all(batch.map(fetchTopHoldings))
            results.push(...batchResults)
            if (i + BATCH < tickers.length) await delay(500)
        }

        return NextResponse.json({ funds: results })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
    }
}
