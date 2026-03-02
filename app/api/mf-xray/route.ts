// app/api/mf-xray/route.ts — Groww SSR scraping for Indian MF holdings
import { NextResponse } from 'next/server'

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/json',
    'Accept-Language': 'en-US,en;q=0.5',
}

interface HoldingItem {
    name: string
    weight: number
    sector: string
    symbol?: string
}

interface FundXray {
    ticker: string
    fundName: string
    holdings: HoldingItem[]
    sectorWeights: { sector: string; weight: number }[]
    error?: string
}

/**
 * Step 1: Search Groww for the fund's search_id (slug).
 * User ticker might be "HDFCFLEXICAP.NS" — we strip suffixes and search.
 */
async function findGrowwSlug(userTicker: string): Promise<string | null> {
    const query = userTicker
        .replace(/\.NS$|\.BO$/i, '')
        .replace(/[-_]/g, ' ')
        .trim()

    try {
        const url = `https://groww.in/v1/api/search/v1/derived/scheme?page=0&query=${encodeURIComponent(query)}&size=5`
        const res = await fetch(url, {
            headers: { ...HEADERS, Accept: 'application/json' },
        })

        if (!res.ok) return null

        const data = await res.json()
        const schemes = data?.content || []

        if (schemes.length === 0) return null

        // Prefer Direct plan schemes
        const direct = schemes.find((s: any) =>
            s.plan_type === 'Direct' || s.search_id?.includes('direct')
        )
        return (direct || schemes[0])?.search_id || null
    } catch {
        return null
    }
}

/**
 * Step 2: Fetch the Groww MF page and extract holdings from __NEXT_DATA__.
 * The SSR data lives at: pageProps.mfServerSideData.holdings[]
 */
async function fetchHoldingsFromGroww(slug: string, originalTicker: string): Promise<FundXray> {
    const result: FundXray = {
        ticker: originalTicker,
        fundName: originalTicker,
        holdings: [],
        sectorWeights: [],
    }

    try {
        const url = `https://groww.in/mutual-funds/${slug}`
        const res = await fetch(url, { headers: HEADERS })

        if (!res.ok) {
            result.error = `Groww returned ${res.status} for ${slug}`
            return result
        }

        const html = await res.text()

        // Extract __NEXT_DATA__ JSON
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\\s\\S]*?)<\/script>/)
        if (!match) {
            result.error = 'Could not parse Groww page data'
            return result
        }

        const nextData = JSON.parse(match[1])
        const mfData = nextData?.props?.pageProps?.mfServerSideData

        if (!mfData) {
            result.error = 'No fund data in page'
            return result
        }

        // Fund name
        result.fundName = mfData.scheme_name || mfData.meta_title || slug

        // Holdings
        const rawHoldings = mfData.holdings || []
        result.holdings = rawHoldings
            .filter((h: any) => h.corpus_per > 0)
            .map((h: any) => ({
                name: h.company_name || 'Unknown',
                weight: h.corpus_per || 0,
                sector: h.sector_name || 'Unknown',
                symbol: h.stock_search_id || undefined,
            }))
            .sort((a: HoldingItem, b: HoldingItem) => b.weight - a.weight)

        // Aggregate sector weights
        const sectorMap: Record<string, number> = {}
        result.holdings.forEach(h => {
            sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.weight
        })
        result.sectorWeights = Object.entries(sectorMap)
            .map(([sector, weight]) => ({ sector, weight }))
            .sort((a, b) => b.weight - a.weight)

    } catch (e: any) {
        result.error = e?.message || 'Fetch failed'
    }

    return result
}

export async function POST(request: Request) {
    try {
        const { tickers } = await request.json()

        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
        }

        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        const funds: FundXray[] = []

        // Process one at a time to be gentle on Groww
        for (const ticker of tickers) {
            // Step 1: Find slug
            const slug = await findGrowwSlug(ticker)

            if (!slug) {
                funds.push({
                    ticker,
                    fundName: ticker,
                    holdings: [],
                    sectorWeights: [],
                    error: `Could not find "${ticker}" on Groww`,
                })
                continue
            }

            // Step 2: Fetch holdings from SSR
            const fundData = await fetchHoldingsFromGroww(slug, ticker)
            funds.push(fundData)

            // Polite delay between requests
            await delay(800)
        }

        return NextResponse.json({ funds })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
    }
}
