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

/**
 * Try to resolve a user's MF ticker (e.g. "HDFCFLEXICAP.NS", "SBI Bluechip")
 * to the Yahoo Finance mutual fund ticker (e.g. "0P0000XVAP.BO").
 * Yahoo's search endpoint returns results with quoteType=MUTUALFUND.
 */
async function resolveYahooTicker(userTicker: string): Promise<string | null> {
    // First, strip .NS / .BO suffixes and clean up for search
    const searchQuery = userTicker
        .replace(/\.NS$|\.BO$/i, '')
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .trim()

    try {
        // Use Yahoo's v1 search endpoint
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&quotesCount=10&lang=en-US`
        const res = await fetch(url, { headers: YAHOO_HEADERS })

        if (!res.ok) return null

        const data = await res.json()
        const quotes = data?.quotes || []

        // Find mutual fund type results
        const mfResults = quotes.filter((q: any) =>
            q.quoteType === 'MUTUALFUND' || q.typeDisp === 'Mutual Fund'
        )

        if (mfResults.length > 0) {
            return mfResults[0].symbol
        }

        // If no MF result, try any result that looks like an Indian MF (starts with 0P)
        const indiaFund = quotes.find((q: any) =>
            q.symbol?.startsWith('0P') && (q.symbol?.endsWith('.BO') || q.symbol?.endsWith('.NS'))
        )
        if (indiaFund) return indiaFund.symbol

        return null
    } catch {
        return null
    }
}

async function fetchTopHoldings(ticker: string, resolvedTicker: string | null): Promise<FundXray> {
    const yahooTicker = resolvedTicker || ticker
    const result: FundXray = {
        ticker,  // keep original user ticker for display
        fundName: ticker,
        holdings: [],
        sectorWeights: [],
        equityPercent: 0,
        bondPercent: 0,
    }

    try {
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=topHoldings,quoteType`
        const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 86400 } })

        if (!res.ok) {
            result.error = `Yahoo returned ${res.status} for ${yahooTicker}`
            return result
        }

        const data = await res.json()
        const quoteSummary = data?.quoteSummary?.result?.[0]

        if (!quoteSummary) {
            result.error = 'No data from Yahoo'
            return result
        }

        const topHoldings = quoteSummary.topHoldings
        const quoteType = quoteSummary.quoteType

        // Fund name from quoteType
        if (quoteType?.shortName) {
            result.fundName = quoteType.shortName
        } else if (quoteType?.longName) {
            result.fundName = quoteType.longName
        }

        if (!topHoldings) {
            result.error = 'No holdings data available'
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

        // Step 1: Resolve each user ticker to a Yahoo MF ticker
        const tickerMap: Record<string, string | null> = {}
        const BATCH = 3
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

        for (let i = 0; i < tickers.length; i += BATCH) {
            const batch = tickers.slice(i, i + BATCH)
            const results = await Promise.all(batch.map(async (t: string) => {
                const resolved = await resolveYahooTicker(t)
                return { original: t, resolved }
            }))
            results.forEach(r => { tickerMap[r.original] = r.resolved })
            if (i + BATCH < tickers.length) await delay(500)
        }

        // Step 2: Fetch holdings for each resolved ticker
        const fundResults: FundXray[] = []
        const tickersToFetch = tickers.filter(t => tickerMap[t] !== null)

        for (let i = 0; i < tickersToFetch.length; i += BATCH) {
            const batch = tickersToFetch.slice(i, i + BATCH)
            const batchResults = await Promise.all(
                batch.map(t => fetchTopHoldings(t, tickerMap[t]))
            )
            fundResults.push(...batchResults)
            if (i + BATCH < tickersToFetch.length) await delay(500)
        }

        // Add unresolved tickers with error
        tickers.filter(t => tickerMap[t] === null).forEach(t => {
            fundResults.push({
                ticker: t,
                fundName: t,
                holdings: [],
                sectorWeights: [],
                equityPercent: 0,
                bondPercent: 0,
                error: `Could not find "${t}" on Yahoo Finance`
            })
        })

        return NextResponse.json({ funds: fundResults })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
    }
}
