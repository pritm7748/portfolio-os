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
 * If the name looks like a MorningStar ID (e.g., "0P00008TMV.BO"),
 * resolve it to a human-readable name via Yahoo search.
 */
async function resolveNameIfNeeded(name: string): Promise<string> {
    // If it doesn't look like a MorningStar ID, return as-is
    if (!name.match(/^0P[0-9A-Z]{8,}/i)) return name

    try {
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(name)}&quotesCount=3`
        const res = await fetch(url, {
            headers: { ...HEADERS, Accept: 'application/json' },
        })
        if (!res.ok) return name

        const data = await res.json()
        const quotes = data?.quotes || []
        if (quotes.length > 0) {
            const q = quotes[0]
            const resolved = q.longname || q.shortname || q.name
            if (resolved && !resolved.match(/^0P/)) {
                console.log(`[MF-XRAY] Resolved MorningStar ID "${name}" -> "${resolved}"`)
                return resolved
            }
        }
    } catch { }

    return name
}

/**
 * Search Groww for the fund's search_id (slug) using entity search.
 * Strips Direct/Growth/Plan suffixes for cleaner matching.
 */
async function findGrowwSlug(fundName: string): Promise<string | null> {
    const query = fundName
        .replace(/\.NS$|\.BO$/i, '')
        .replace(/\s*-\s*/g, ' ')
        .replace(/\s*Direct\s*Plan\s*/gi, ' ')
        .replace(/\s*Direct\s*/gi, ' ')
        .replace(/\s*Growth\s*Option\s*/gi, ' ')
        .replace(/\s*Growth\s*/gi, ' ')
        .replace(/\s*Plan\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (!query || query.length < 3) return null

    console.log(`[MF-XRAY] Groww search query: "${query}"`)

    try {
        const url = `https://groww.in/v1/api/search/v1/entity?q=${encodeURIComponent(query)}&entity_type=scheme&size=5`
        const res = await fetch(url, {
            headers: { ...HEADERS, Accept: 'application/json' },
        })

        if (!res.ok) {
            console.log(`[MF-XRAY] Groww search status: ${res.status}`)
            return null
        }

        const data = await res.json()
        const results = data?.content || []

        console.log(`[MF-XRAY] Groww results: ${results.length}`)

        if (results.length === 0) return null

        // Prefer Direct plan results
        const direct = results.find((s: any) =>
            s.search_id?.includes('direct') || s.title?.toLowerCase().includes('direct')
        )
        const best = direct || results[0]
        console.log(`[MF-XRAY] Best match: ${best.search_id} | ${best.title}`)
        return best?.search_id || null
    } catch (e: any) {
        console.log(`[MF-XRAY] Groww search error: ${e.message}`)
        return null
    }
}

/**
 * Fetch the Groww MF page and extract holdings from __NEXT_DATA__.
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

        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
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

        result.fundName = mfData.scheme_name || mfData.meta_title || slug

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
        const { tickers, names } = await request.json()

        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
        }

        const nameMap: Record<string, string> = names || {}
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        const funds: FundXray[] = []

        for (const ticker of tickers) {
            let searchName = nameMap[ticker] || ticker
            console.log(`[MF-XRAY] Processing ticker="${ticker}" name="${searchName}"`)

            // If name is a MorningStar ID (starts with 0P), resolve to human name
            searchName = await resolveNameIfNeeded(searchName)

            const slug = await findGrowwSlug(searchName)
            console.log(`[MF-XRAY] -> Final slug: ${slug || 'NOT FOUND'}`)

            if (!slug) {
                funds.push({
                    ticker,
                    fundName: searchName,
                    holdings: [],
                    sectorWeights: [],
                    error: `Could not find "${searchName}" on Groww`,
                })
                continue
            }

            const fundData = await fetchHoldingsFromGroww(slug, ticker)
            funds.push(fundData)

            await delay(800)
        }

        return NextResponse.json({ funds })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
    }
}
