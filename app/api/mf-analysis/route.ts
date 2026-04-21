// app/api/mf-analysis/route.ts — Deep MF analysis via Groww + MFAPI
import { NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const HEADERS = { 'User-Agent': UA, Accept: 'text/html,application/json', 'Accept-Language': 'en-US,en;q=0.5' }
const RISK_FREE_RATE = 0.065 // 6.5% for India

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

function parseDate(d: string): Date {
    const [day, month, year] = d.split('-')
    const months: Record<string, number> = { '01': 0, '02': 1, '03': 2, '04': 3, '05': 4, '06': 5, '07': 6, '08': 7, '09': 8, '10': 9, '11': 10, '12': 11 }
    return new Date(+year, months[month] ?? 0, +day)
}

function cagr(startNav: number, endNav: number, years: number): number {
    if (years <= 0 || startNav <= 0) return 0
    return (Math.pow(endNav / startNav, 1 / years) - 1) * 100
}

function absoluteReturn(startNav: number, endNav: number): number {
    if (startNav <= 0) return 0
    return ((endNav - startNav) / startNav) * 100
}

// ════════════════════════════════════════════════════════════════
//  1. GROWW SCRAPING — Extract ALL fields from __NEXT_DATA__
// ════════════════════════════════════════════════════════════════

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

    try {
        const url = `https://groww.in/v1/api/search/v1/entity?q=${encodeURIComponent(query)}&entity_type=scheme&size=5`
        const res = await fetch(url, { headers: { ...HEADERS, Accept: 'application/json' } })
        if (!res.ok) return null
        const data = await res.json()
        const results = data?.content || []
        if (results.length === 0) return null
        const direct = results.find((s: any) => s.search_id?.includes('direct') || s.title?.toLowerCase().includes('direct'))
        return (direct || results[0])?.search_id || null
    } catch { return null }
}

async function scrapeGroww(slug: string) {
    const result: any = { holdings: [], sectorWeights: [], changes: { additions: [], exits: [], increased: [], decreased: [] }, marketCap: {}, peers: [] }
    try {
        const res = await fetch(`https://groww.in/mutual-funds/${slug}`, { headers: HEADERS })
        if (!res.ok) { result.error = `Groww ${res.status}`; return result }
        const html = await res.text()
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
        if (!match) { result.error = 'No __NEXT_DATA__'; return result }

        const nextData = JSON.parse(match[1])
        const mf = nextData?.props?.pageProps?.mfServerSideData
        if (!mf) { result.error = 'No mfServerSideData'; return result }

        // Meta
        result.fundName = mf.scheme_name || mf.meta_title || slug
        result.category = mf.scheme_category || mf.sub_category || ''
        result.fundHouse = mf.fund_house || mf.amc || ''
        result.aum = mf.aum || mf.net_assets || 0
        result.expenseRatio = mf.expense_ratio ?? null
        result.exitLoad = mf.exit_load || mf.exit_load_message || ''
        result.riskRating = mf.riskometer || mf.risk_rating || mf.scheme_risk || ''
        result.benchmark = mf.benchmark || mf.benchmark_name || ''
        result.fundManager = mf.fund_manager || mf.fund_managers || ''
        result.launchDate = mf.launch_date || mf.inception_date || ''
        result.minSip = mf.min_sip_amount || mf.sip_min_amount || 500
        result.minLumpsum = mf.min_investment_amount || mf.lumpsum_min || 5000
        result.returnsMeta = mf.returns || mf.scheme_returns || null
        result.riskMeta = mf.risk_measures || mf.ratios || null

        // Holdings
        const rawHoldings = mf.holdings || []
        result.holdings = rawHoldings
            .filter((h: any) => h.corpus_per > 0)
            .map((h: any) => ({
                name: h.company_name || 'Unknown',
                weight: h.corpus_per || 0,
                sector: h.sector_name || 'Unknown',
                symbol: h.stock_search_id || h.nse_script_code || undefined,
                marketCap: h.market_cap_type || undefined,
            }))
            .sort((a: any, b: any) => b.weight - a.weight)

        // Sector weights
        const sectorMap: Record<string, number> = {}
        result.holdings.forEach((h: any) => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.weight })
        result.sectorWeights = Object.entries(sectorMap)
            .map(([sector, weight]) => ({ sector, weight }))
            .sort((a, b) => b.weight - a.weight)

        // Market cap allocation
        const capMap: Record<string, number> = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0, 'Other': 0 }
        if (mf.market_cap_allocation) {
            result.marketCap = mf.market_cap_allocation
        } else {
            result.holdings.forEach((h: any) => {
                const cap = h.marketCap || 'Other'
                if (cap.toLowerCase().includes('large')) capMap['Large Cap'] += h.weight
                else if (cap.toLowerCase().includes('mid')) capMap['Mid Cap'] += h.weight
                else if (cap.toLowerCase().includes('small')) capMap['Small Cap'] += h.weight
                else capMap['Other'] += h.weight
            })
            result.marketCap = capMap
        }

        // Holdings changes
        const rawChanges = mf.holdings_change || mf.portfolio_changes || {}
        result.changes = {
            additions: (rawChanges.new_additions || rawChanges.added || []).map((c: any) => ({
                name: c.company_name || c.name || '',
                weight: c.corpus_per || c.weight || 0,
                sector: c.sector_name || c.sector || '',
            })),
            exits: (rawChanges.complete_exits || rawChanges.removed || []).map((c: any) => ({
                name: c.company_name || c.name || '',
                lastWeight: c.corpus_per || c.weight || 0,
                sector: c.sector_name || c.sector || '',
            })),
            increased: (rawChanges.weight_increased || rawChanges.increased || []).map((c: any) => ({
                name: c.company_name || c.name || '',
                currentWeight: c.corpus_per || c.current_weight || 0,
                previousWeight: c.prev_corpus_per || c.previous_weight || 0,
                change: (c.corpus_per || 0) - (c.prev_corpus_per || 0),
                sector: c.sector_name || c.sector || '',
            })),
            decreased: (rawChanges.weight_decreased || rawChanges.decreased || []).map((c: any) => ({
                name: c.company_name || c.name || '',
                currentWeight: c.corpus_per || c.current_weight || 0,
                previousWeight: c.prev_corpus_per || c.previous_weight || 0,
                change: (c.corpus_per || 0) - (c.prev_corpus_per || 0),
                sector: c.sector_name || c.sector || '',
            })),
        }

        // Peers
        const rawPeers = mf.peer_funds || mf.similar_funds || mf.peers || []
        result.peers = rawPeers.slice(0, 10).map((p: any) => ({
            name: p.scheme_name || p.name || '',
            category: p.scheme_category || p.category || '',
            aum: p.aum || p.net_assets || 0,
            expenseRatio: p.expense_ratio ?? null,
            return1Y: p.return_1y ?? p.returns_1yr ?? null,
            return3Y: p.return_3y ?? p.returns_3yr ?? null,
            return5Y: p.return_5y ?? p.returns_5yr ?? null,
            riskRating: p.riskometer || p.risk_rating || '',
            slug: p.search_id || '',
        }))

    } catch (e: any) { result.error = e.message }
    return result
}

// ════════════════════════════════════════════════════════════════
//  2. MFAPI — NAV history + scheme code search
// ════════════════════════════════════════════════════════════════

async function findSchemeCode(fundName: string): Promise<number | null> {
    try {
        const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(fundName)}`, { headers: { 'User-Agent': UA } })
        if (!res.ok) return null
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) return null
        // Prefer Direct Growth
        const direct = data.find((s: any) =>
            (s.schemeName || '').toLowerCase().includes('direct') &&
            (s.schemeName || '').toLowerCase().includes('growth')
        )
        return (direct || data[0])?.schemeCode || null
    } catch { return null }
}

async function fetchNavHistory(schemeCode: number): Promise<{ date: string; nav: number }[]> {
    try {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, { headers: { 'User-Agent': UA } })
        if (!res.ok) return []
        const data = await res.json()
        if (data.status !== 'SUCCESS' || !Array.isArray(data.data)) return []
        return data.data
            .filter((d: any) => +d.nav > 0)
            .map((d: any) => ({ date: d.date, nav: +d.nav }))
    } catch { return [] }
}

// ════════════════════════════════════════════════════════════════
//  3. COMPUTED METRICS
// ════════════════════════════════════════════════════════════════

function computeMetrics(navs: { date: string; nav: number }[]) {
    if (navs.length < 2) return null

    // navs are newest-first from MFAPI, reverse for chronological
    const sorted = [...navs].reverse()
    const latest = sorted[sorted.length - 1]
    const latestDate = parseDate(latest.date)
    const latestNav = latest.nav

    // ── Trailing returns ──
    function findNavAtOffset(months: number): number | null {
        const target = new Date(latestDate)
        target.setMonth(target.getMonth() - months)
        // Find closest NAV on or before target date
        for (let i = sorted.length - 1; i >= 0; i--) {
            const d = parseDate(sorted[i].date)
            if (d <= target) return sorted[i].nav
        }
        return null
    }

    const trailingPeriods = [
        { key: '1M', months: 1 }, { key: '3M', months: 3 }, { key: '6M', months: 6 },
        { key: '1Y', months: 12 }, { key: '2Y', months: 24 }, { key: '3Y', months: 36 },
        { key: '5Y', months: 60 }, { key: '10Y', months: 120 },
    ]

    const trailing: Record<string, number | null> = {}
    for (const p of trailingPeriods) {
        const startNav = findNavAtOffset(p.months)
        if (startNav) {
            const years = p.months / 12
            trailing[p.key] = years >= 1 ? cagr(startNav, latestNav, years) : absoluteReturn(startNav, latestNav)
        } else {
            trailing[p.key] = null
        }
    }

    // Since inception
    const inceptionNav = sorted[0].nav
    const inceptionDate = parseDate(sorted[0].date)
    const totalYears = (latestDate.getTime() - inceptionDate.getTime()) / (365.25 * 24 * 3600 * 1000)
    trailing['SI'] = totalYears >= 1 ? cagr(inceptionNav, latestNav, totalYears) : absoluteReturn(inceptionNav, latestNav)

    // YTD
    const ytdStart = new Date(latestDate.getFullYear(), 0, 1)
    let ytdNav = null
    for (let i = sorted.length - 1; i >= 0; i--) {
        if (parseDate(sorted[i].date) <= ytdStart) { ytdNav = sorted[i].nav; break }
    }
    trailing['YTD'] = ytdNav ? absoluteReturn(ytdNav, latestNav) : null

    // ── Calendar year returns ──
    const years = new Set(sorted.map(s => parseDate(s.date).getFullYear()))
    const calendarReturns: { year: number; return: number }[] = []
    for (const yr of Array.from(years).sort()) {
        const yearNavs = sorted.filter(s => parseDate(s.date).getFullYear() === yr)
        if (yearNavs.length < 2) continue
        const first = yearNavs[0].nav
        const last = yearNavs[yearNavs.length - 1].nav
        calendarReturns.push({ year: yr, return: absoluteReturn(first, last) })
    }

    // ── Daily returns for risk calcs ──
    const dailyReturns: number[] = []
    for (let i = 1; i < sorted.length; i++) {
        dailyReturns.push((sorted[i].nav - sorted[i - 1].nav) / sorted[i - 1].nav)
    }

    // Use trailing 1Y for annualized risk (last ~250 trading days)
    const recent = dailyReturns.slice(-252)

    // Standard Deviation (annualized)
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length
    const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length
    const stdDev1Y = Math.sqrt(variance) * Math.sqrt(252) * 100

    // 3Y std dev
    const recent3Y = dailyReturns.slice(-756)
    const mean3Y = recent3Y.reduce((a, b) => a + b, 0) / recent3Y.length
    const var3Y = recent3Y.reduce((a, b) => a + Math.pow(b - mean3Y, 2), 0) / recent3Y.length
    const stdDev3Y = Math.sqrt(var3Y) * Math.sqrt(252) * 100

    // Sharpe Ratio
    const annualReturn = (trailing['1Y'] || 0) / 100
    const sharpe = stdDev1Y > 0 ? (annualReturn - RISK_FREE_RATE) / (stdDev1Y / 100) : 0

    // Sortino (using downside deviation)
    const downsideReturns = recent.filter(r => r < 0)
    const downsideVar = downsideReturns.length > 0
        ? downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / downsideReturns.length
        : 0
    const downsideDev = Math.sqrt(downsideVar) * Math.sqrt(252) * 100
    const sortino = downsideDev > 0 ? (annualReturn - RISK_FREE_RATE) / (downsideDev / 100) : 0

    // Max Drawdown
    let maxDD = 0, peak = sorted[0].nav, ddStart = '', ddEnd = '', ddPeakDate = sorted[0].date
    let currentDDStart = sorted[0].date
    for (const s of sorted) {
        if (s.nav > peak) { peak = s.nav; currentDDStart = s.date; ddPeakDate = s.date }
        const dd = (peak - s.nav) / peak
        if (dd > maxDD) { maxDD = dd; ddStart = ddPeakDate; ddEnd = s.date }
    }

    // Best/Worst day
    let bestDay = { date: '', return: -Infinity }, worstDay = { date: '', return: Infinity }
    for (let i = 1; i < sorted.length; i++) {
        const r = (sorted[i].nav - sorted[i - 1].nav) / sorted[i - 1].nav * 100
        if (r > bestDay.return) bestDay = { date: sorted[i].date, return: r }
        if (r < worstDay.return) worstDay = { date: sorted[i].date, return: r }
    }

    // ── Monthly return heatmap ──
    const monthlyMap: Record<string, { start: number; end: number }> = {}
    for (const s of sorted) {
        const d = parseDate(s.date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyMap[key]) monthlyMap[key] = { start: s.nav, end: s.nav }
        monthlyMap[key].end = s.nav
    }
    const monthlyReturns: { year: number; month: number; return: number }[] = []
    for (const [key, v] of Object.entries(monthlyMap)) {
        const [yr, mo] = key.split('-').map(Number)
        monthlyReturns.push({ year: yr, month: mo, return: absoluteReturn(v.start, v.end) })
    }
    // Keep last 5 years
    const cutoffYear = latestDate.getFullYear() - 5
    const heatmap = monthlyReturns.filter(m => m.year >= cutoffYear).sort((a, b) => a.year - b.year || a.month - b.month)

    // ── Rolling 1Y returns (sampled weekly for last 5Y) ──
    const rollingReturns: { date: string; return: number }[] = []
    const fiveYearsAgo = new Date(latestDate)
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    for (let i = 252; i < sorted.length; i += 5) { // step 5 ≈ weekly
        const d = parseDate(sorted[i].date)
        if (d < fiveYearsAgo) continue
        const pastNav = sorted[i - 252]?.nav
        if (pastNav && pastNav > 0) {
            rollingReturns.push({ date: sorted[i].date, return: cagr(pastNav, sorted[i].nav, 1) })
        }
    }
    const rollingMin = rollingReturns.length > 0 ? Math.min(...rollingReturns.map(r => r.return)) : 0
    const rollingMax = rollingReturns.length > 0 ? Math.max(...rollingReturns.map(r => r.return)) : 0
    const rollingAvg = rollingReturns.length > 0 ? rollingReturns.reduce((a, b) => a + b.return, 0) / rollingReturns.length : 0

    // ── Drawdown series (sampled for chart) ──
    const drawdownSeries: { date: string; drawdown: number }[] = []
    peak = sorted[0].nav
    for (let i = 0; i < sorted.length; i += 5) {
        if (sorted[i].nav > peak) peak = sorted[i].nav
        const d = parseDate(sorted[i].date)
        if (d < fiveYearsAgo) continue
        drawdownSeries.push({ date: sorted[i].date, drawdown: -((peak - sorted[i].nav) / peak) * 100 })
    }

    // ── NAV chart data (sampled monthly for 5Y, daily for 1M) ──
    const navChart: { date: string; nav: number }[] = []
    const oneMonthAgo = new Date(latestDate)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    let lastMonth = ''
    for (const s of sorted) {
        const d = parseDate(s.date)
        if (d < fiveYearsAgo) continue
        if (d >= oneMonthAgo) {
            navChart.push(s) // daily for recent month
        } else {
            const monthKey = `${d.getFullYear()}-${d.getMonth()}`
            if (monthKey !== lastMonth) { navChart.push(s); lastMonth = monthKey }
        }
    }

    // ── Default SIP simulation (₹5000/mo, 5Y) ──
    const sipAmount = 5000
    let totalUnits = 0, totalInvested = 0
    const sipData: { date: string; invested: number; value: number }[] = []
    let lastSipMonth = ''
    for (const s of sorted) {
        const d = parseDate(s.date)
        if (d < fiveYearsAgo) continue
        const sipMonth = `${d.getFullYear()}-${d.getMonth()}`
        if (sipMonth !== lastSipMonth) {
            totalUnits += sipAmount / s.nav
            totalInvested += sipAmount
            lastSipMonth = sipMonth
        }
        sipData.push({ date: s.date, invested: totalInvested, value: +(totalUnits * s.nav).toFixed(2) })
    }
    // Sample SIP data to ~100 points
    const sipSampled = sipData.length > 100
        ? sipData.filter((_, i) => i % Math.ceil(sipData.length / 100) === 0 || i === sipData.length - 1)
        : sipData

    const sipResult = {
        monthlyAmount: sipAmount,
        totalInvested,
        currentValue: totalUnits * latestNav,
        totalUnits,
        xirr: totalInvested > 0 ? cagr(totalInvested, totalUnits * latestNav, Math.min(totalYears, 5)) : 0,
        chartData: sipSampled,
    }

    return {
        nav: { current: latestNav, date: latest.date },
        trailing,
        calendarReturns: calendarReturns.slice(-10), // last 10 years
        risk: {
            stdDev1Y: +stdDev1Y.toFixed(2),
            stdDev3Y: +stdDev3Y.toFixed(2),
            sharpe: +sharpe.toFixed(2),
            sortino: +sortino.toFixed(2),
            maxDrawdown: +(maxDD * 100).toFixed(2),
            maxDrawdownPeriod: { from: ddStart, to: ddEnd },
            bestDay: { date: bestDay.date, return: +bestDay.return.toFixed(2) },
            worstDay: { date: worstDay.date, return: +worstDay.return.toFixed(2) },
        },
        rollingReturns: { series: rollingReturns, min: +rollingMin.toFixed(2), max: +rollingMax.toFixed(2), avg: +rollingAvg.toFixed(2) },
        drawdownSeries,
        heatmap,
        navChart,
        sip: sipResult,
    }
}

// ════════════════════════════════════════════════════════════════
//  4. MAIN HANDLER
// ════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
    try {
        const { fundName } = await request.json()
        if (!fundName) return NextResponse.json({ error: 'Missing fundName' }, { status: 400 })

        console.log(`[MF-ANALYSIS] Analyzing: ${fundName}`)

        // Run Groww + MFAPI in parallel
        const slugPromise = findGrowwSlug(fundName)
        const schemePromise = findSchemeCode(fundName)

        const [slug, schemeCode] = await Promise.all([slugPromise, schemePromise])

        // Fetch data in parallel
        const growwPromise = slug ? scrapeGroww(slug) : Promise.resolve({ error: 'No Groww slug found' })
        const navPromise = schemeCode ? fetchNavHistory(schemeCode) : Promise.resolve([])

        const [growwData, navHistory] = await Promise.all([growwPromise, navPromise])
        const metrics = computeMetrics(navHistory)

        const response = {
            meta: {
                fundName: growwData.fundName || fundName,
                category: growwData.category || '',
                fundHouse: growwData.fundHouse || '',
                aum: growwData.aum || 0,
                expenseRatio: growwData.expenseRatio,
                exitLoad: growwData.exitLoad || '',
                riskRating: growwData.riskRating || '',
                benchmark: growwData.benchmark || '',
                fundManager: growwData.fundManager || '',
                launchDate: growwData.launchDate || '',
                minSip: growwData.minSip || 500,
                minLumpsum: growwData.minLumpsum || 5000,
                schemeCode,
            },
            nav: metrics?.nav || null,
            returns: {
                trailing: metrics?.trailing || {},
                calendarYear: metrics?.calendarReturns || [],
            },
            risk: metrics?.risk || null,
            rollingReturns: metrics?.rollingReturns || null,
            drawdownSeries: metrics?.drawdownSeries || [],
            heatmap: metrics?.heatmap || [],
            navChart: metrics?.navChart || [],
            allocation: {
                marketCap: growwData.marketCap || {},
                sectors: growwData.sectorWeights || [],
                concentration: {
                    top5: growwData.holdings?.slice(0, 5).reduce((a: number, h: any) => a + h.weight, 0) || 0,
                    top10: growwData.holdings?.slice(0, 10).reduce((a: number, h: any) => a + h.weight, 0) || 0,
                    hhi: growwData.holdings?.reduce((a: number, h: any) => a + Math.pow(h.weight, 2), 0) || 0,
                    totalStocks: growwData.holdings?.length || 0,
                },
            },
            holdings: {
                current: growwData.holdings || [],
                changes: growwData.changes || { additions: [], exits: [], increased: [], decreased: [] },
            },
            peers: growwData.peers || [],
            sip: metrics?.sip || null,
            growwSlug: slug,
            growwError: growwData.error,
            returnsMeta: growwData.returnsMeta,
        }

        console.log(`[MF-ANALYSIS] Done: ${response.meta.fundName} | ${response.allocation.concentration.totalStocks} holdings | ${navHistory.length} NAV points`)
        return NextResponse.json(response)

    } catch (e: any) {
        console.error('[MF-ANALYSIS] Error:', e.message)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
