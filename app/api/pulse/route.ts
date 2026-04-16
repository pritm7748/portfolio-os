// app/api/pulse/route.ts — Streaming with Supabase cache for verified users
import { NseIndia } from 'stock-nse-india'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// ════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════

const MACRO_TICKERS = [
    { symbol: 'INR=X', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    { symbol: 'CL=F', name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: 'GC=F', name: 'Gold (Global)', type: 'Commodity', prefix: '$', suffix: '' },
    { symbol: '^TNX', name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
]

const YAHOO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

const PUB_LOOKBACK_DAYS = 45
const PUB_MAX_PER_TICKER = 10
const PUB_TOTAL_LIMIT = 300
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

// ════════════════════════════════════════════════════════════════
//  YAHOO
// ════════════════════════════════════════════════════════════════

async function fetchYahooQuote(symbol: string): Promise<any | null> {
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
            { headers: YAHOO_HEADERS, next: { revalidate: 60 } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const result = data?.chart?.result?.[0]
        if (!result) return null

        const meta = result.meta
        const quotes = result.indicators?.quote?.[0] || {}
        const currentPrice = meta?.regularMarketPrice || 0
        const previousClose = meta?.chartPreviousClose || meta?.previousClose || 0
        const change = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0
        const volumes = quotes.volume || []
        const latestVolume = volumes[volumes.length - 1] || 0
        const validVolumes = volumes.filter((v: number) => v && v > 0)
        const avgVolume = validVolumes.length > 1
            ? validVolumes.slice(0, -1).reduce((a: number, b: number) => a + b, 0) / (validVolumes.length - 1)
            : latestVolume

        return { price: currentPrice, previousClose, change, volume: latestVolume, avgVolume, volumeRatio: avgVolume > 0 ? latestVolume / avgVolume : 0 }
    } catch (e) { return null }
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

function toNSESymbol(ticker: string): string {
    return ticker.toUpperCase().replace('.NS', '').replace('.BO', '').replace(':NSE', '').trim()
}

function isIndianStock(ticker: string): boolean {
    const t = ticker.toUpperCase()
    return !t.includes('^') && !t.includes('=') && !t.startsWith('COMMODITY:')
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    const parts = dateStr.split(/[-\/\s]+/)
    if (parts.length >= 3) {
        const attempt = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`)
        if (!isNaN(attempt.getTime())) return attempt
    }
    return null
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function computePortfolioHash(tickers: string[]): string {
    return crypto.createHash('md5').update(tickers.slice().sort().join('|')).digest('hex')
}

/** Prune expired items from cached data */
function pruneExpired(data: any): any {
    const now = Date.now()
    const sevenDaysAgo = new Date(now - 7 * 86400000)
    const pubCutoff = new Date(now - PUB_LOOKBACK_DAYS * 86400000)

    return {
        ...data,
        events: (data.events || []).filter((e: any) => {
            const d = new Date(e.date)
            return d >= sevenDaysAgo // Keep future events + recent past events
        }),
        publications: (data.publications || []).filter((p: any) => {
            const d = new Date(p.date)
            return d >= pubCutoff
        }).slice(0, PUB_TOTAL_LIMIT),
        // Shockers are daily — always stale, will be re-fetched
        shockers: [],
    }
}

// ════════════════════════════════════════════════════════════════
//  SUPABASE CACHE
// ════════════════════════════════════════════════════════════════

async function loadCache(userId: string, hash: string) {
    try {
        const supabase = await createClient()
        const { data } = await supabase
            .from('pulse_cache')
            .select('data, portfolio_hash, updated_at')
            .eq('user_id', userId)
            .single()

        if (data && data.portfolio_hash === hash) {
            const age = Date.now() - new Date(data.updated_at).getTime()
            if (age < CACHE_TTL_MS) {
                return { cached: data.data, age }
            }
        }
    } catch { }
    return null
}

async function saveCache(userId: string, hash: string, pulseData: any) {
    try {
        const supabase = await createClient()
        await supabase
            .from('pulse_cache')
            .upsert({
                user_id: userId,
                portfolio_hash: hash,
                data: pulseData,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
        console.log(`[PULSE] Cache saved for user ${userId.substring(0, 8)}...`)
    } catch (e) {
        console.log('[PULSE] Cache save failed:', (e as any)?.message)
    }
}

// ════════════════════════════════════════════════════════════════
//  STREAMING HANDLER
// ════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
    try {
        const { tickers, forceRefresh } = await request.json()
        const uniqueTickers = Array.from(new Set((tickers || []) as string[]))
        const portfolioHash = computePortfolioHash(uniqueTickers)

        // Auth check
        let userId: string | null = null
        try {
            const supabase = await createClient()
            const { data: { user } } = await supabase.auth.getUser()
            userId = user?.id || null
        } catch { }

        // ── Check Supabase cache for authenticated users ──
        if (userId && !forceRefresh) {
            const cached = await loadCache(userId, portfolioHash)
            if (cached) {
                console.log(`[PULSE] Cache hit for user ${userId.substring(0, 8)}... (${Math.round(cached.age / 60000)}min old)`)
                const prunedData = pruneExpired(cached.cached)

                // Return cached data but fetch fresh macro (live prices)
                const encoder = new TextEncoder()
                const stream = new ReadableStream({
                    async start(controller) {
                        const send = (type: string, data: any) => {
                            controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + '\n'))
                        }

                        // Send cached events/publications immediately
                        if (prunedData.events?.length > 0) send('events', prunedData.events)
                        if (prunedData.publications?.length > 0) send('publications', prunedData.publications)

                        // Always fetch fresh macro (live data)
                        send('progress', { done: 0, total: MACRO_TICKERS.length, label: 'Updating live data...' })
                        const macroResults: any[] = []
                        await Promise.all(MACRO_TICKERS.map(async (m) => {
                            const quote = await fetchYahooQuote(m.symbol)
                            if (quote) {
                                macroResults.push({
                                    name: m.name, price: quote.price, change: quote.change,
                                    type: m.type, prefix: m.prefix, suffix: m.suffix
                                })
                            }
                        }))
                        send('macro', macroResults)

                        // Fetch fresh volume shockers (daily data, not cacheable)
                        const indianTickers = uniqueTickers.filter(isIndianStock)
                        const nonIndianTickers = uniqueTickers.filter(t => !isIndianStock(t))

                        // Non-Indian shockers
                        const freshShockers: any[] = []
                        await Promise.all(nonIndianTickers.map(async (ticker) => {
                            const quote = await fetchYahooQuote(ticker)
                            if (quote && quote.volumeRatio > 2.5 && quote.volume > 10000) {
                                freshShockers.push({
                                    ticker: ticker.replace('.NS', '').replace('.BO', ''),
                                    volume: quote.volume, avgVolume: quote.avgVolume,
                                    ratio: quote.volumeRatio.toFixed(1) + 'x', change: quote.change
                                })
                            }
                        }))

                        // Indian shockers — quick scan with Yahoo only (skip NSE for speed)
                        if (indianTickers.length > 0) {
                            const BATCH = 5
                            for (let i = 0; i < indianTickers.length; i += BATCH) {
                                const batch = indianTickers.slice(i, i + BATCH)
                                await Promise.all(batch.map(async (ticker) => {
                                    const yahoo = await fetchYahooQuote(ticker.includes('.') ? ticker : ticker + '.NS')
                                    if (yahoo && yahoo.volumeRatio > 2.5 && yahoo.volume > 10000) {
                                        freshShockers.push({
                                            ticker: toNSESymbol(ticker),
                                            volume: yahoo.volume, avgVolume: yahoo.avgVolume,
                                            ratio: yahoo.volumeRatio.toFixed(1) + 'x', change: yahoo.change
                                        })
                                    }
                                }))
                            }
                        }

                        if (freshShockers.length > 0) {
                            freshShockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))
                            send('shockers', freshShockers)
                        }

                        send('done', { total: 0, fromCache: true })
                        controller.close()
                    }
                })

                return new Response(stream, {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Transfer-Encoding': 'chunked',
                        'Cache-Control': 'no-cache',
                    }
                })
            }
        }

        // ── Full scan (no cache or forced refresh) ──
        const now = Date.now()
        const sevenDaysAgo = new Date(now - 7 * 86400000)
        const ninetyDaysFromNow = new Date(now + 90 * 86400000)
        const pubCutoff = new Date(now - PUB_LOOKBACK_DAYS * 86400000)

        const indianTickers = uniqueTickers.filter(isIndianStock)
        const nonIndianTickers = uniqueTickers.filter(t => !isIndianStock(t))

        const encoder = new TextEncoder()

        // Accumulator for cache save
        const accumulated = { macro: [] as any[], shockers: [] as any[], events: [] as any[], publications: [] as any[] }

        const stream = new ReadableStream({
            async start(controller) {
                const send = (type: string, data: any) => {
                    controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + '\n'))
                }
                const progress = (done: number, total: number, label: string) => {
                    send('progress', { done, total, label })
                }

                const totalSteps = indianTickers.length + nonIndianTickers.length + MACRO_TICKERS.length
                let completedSteps = 0

                // ── Macro ──
                progress(0, totalSteps, 'Fetching macro data...')
                await Promise.all(MACRO_TICKERS.map(async (m) => {
                    const quote = await fetchYahooQuote(m.symbol)
                    if (quote) {
                        accumulated.macro.push({
                            name: m.name, price: quote.price, change: quote.change,
                            type: m.type, prefix: m.prefix, suffix: m.suffix
                        })
                    }
                    completedSteps++
                }))
                send('macro', accumulated.macro)

                // ── Non-Indian shockers ──
                if (nonIndianTickers.length > 0) {
                    progress(completedSteps, totalSteps, 'Checking international stocks...')
                    await Promise.all(nonIndianTickers.map(async (ticker) => {
                        const quote = await fetchYahooQuote(ticker)
                        if (quote && quote.volumeRatio > 2.5 && quote.volume > 10000) {
                            accumulated.shockers.push({
                                ticker: ticker.replace('.NS', '').replace('.BO', ''),
                                volume: quote.volume, avgVolume: quote.avgVolume,
                                ratio: quote.volumeRatio.toFixed(1) + 'x', change: quote.change
                            })
                        }
                        completedSteps++
                    }))
                    if (accumulated.shockers.length > 0) send('shockers', accumulated.shockers)
                }

                // ── NSE data — batches of 3 ──
                if (indianTickers.length > 0) {
                    const nse = new NseIndia()
                    const BATCH = 3
                    const BATCH_DELAY = 400

                    for (let i = 0; i < indianTickers.length; i += BATCH) {
                        const batch = indianTickers.slice(i, i + BATCH)
                        const batchShockers: any[] = []
                        const batchEvents: any[] = []
                        const batchPubs: any[] = []

                        progress(completedSteps, totalSteps, `Scanning ${batch.join(', ')}...`)

                        await Promise.all(batch.map(async (ticker) => {
                            const sym = toNSESymbol(ticker)

                            // Volume shocker
                            try {
                                const [tradeInfo, details, yahoo] = await Promise.all([
                                    nse.getEquityTradeInfo(sym),
                                    nse.getEquityDetails(sym),
                                    fetchYahooQuote(ticker.includes('.') ? ticker : ticker + '.NS')
                                ])

                                const volume = tradeInfo?.marketDeptOrderBook?.tradeInfo?.totalTradedVolume || 0
                                const lastPrice = details?.priceInfo?.lastPrice || 0
                                const previousClose = details?.priceInfo?.previousClose || 0
                                const change = previousClose > 0 ? ((lastPrice - previousClose) / previousClose) * 100 : 0
                                const avgVolume = yahoo?.avgVolume || volume
                                const volumeRatio = avgVolume > 0 ? volume / avgVolume : 0

                                if (volumeRatio > 2.5 && volume > 10000) {
                                    batchShockers.push({
                                        ticker: sym, volume, avgVolume,
                                        ratio: volumeRatio.toFixed(1) + 'x', change
                                    })
                                }
                            } catch (e) { /* skip */ }

                            // Events
                            try {
                                const corpInfo = await nse.getEquityCorporateInfo(sym)

                                const actions = corpInfo?.corporate_actions?.data || []
                                actions.forEach((action: any) => {
                                    const exDate = parseDate(action.exdate)
                                    if (!exDate || exDate < sevenDaysAgo || exDate > ninetyDaysFromNow) return

                                    const purpose = (action.purpose || '').toLowerCase()
                                    let type = 'Corporate Action', desc = action.purpose || 'Corporate Action'

                                    if (purpose.includes('dividend')) { type = 'Dividend'; desc = `Ex-Dividend: ${action.purpose}` }
                                    else if (purpose.includes('split') || purpose.includes('sub-division')) { type = 'Split'; desc = `Stock Split: ${action.purpose}` }
                                    else if (purpose.includes('bonus')) { type = 'Bonus'; desc = `Bonus Issue: ${action.purpose}` }
                                    else if (purpose.includes('rights')) { type = 'Rights'; desc = `Rights Issue: ${action.purpose}` }
                                    else if (purpose.includes('buyback')) { type = 'Buyback'; desc = `Buyback: ${action.purpose}` }

                                    batchEvents.push({ ticker: sym, type, date: exDate.toISOString(), desc: desc.length > 100 ? desc.substring(0, 97) + '...' : desc })
                                })

                                const meetings = corpInfo?.borad_meeting?.data || []
                                meetings.forEach((meeting: any) => {
                                    const meetingDate = parseDate(meeting.meetingdate)
                                    if (!meetingDate || meetingDate < sevenDaysAgo || meetingDate > ninetyDaysFromNow) return
                                    const purpose = meeting.purpose || 'Board Meeting'
                                    batchEvents.push({
                                        ticker: sym, type: 'Board Meeting',
                                        date: meetingDate.toISOString(),
                                        desc: purpose.length > 100 ? purpose.substring(0, 97) + '...' : purpose
                                    })
                                })

                                const results = corpInfo?.financial_results?.data || []
                                results.slice(0, 1).forEach((result: any) => {
                                    const toDate = parseDate(result.to_date)
                                    if (!toDate || toDate < sevenDaysAgo) return
                                    batchEvents.push({
                                        ticker: sym, type: 'Earnings',
                                        date: toDate.toISOString(),
                                        desc: `Results: Income ₹${Number(result.income || 0).toLocaleString('en-IN')}Cr | EPS ₹${result.reDilEPS || 'N/A'}`
                                    })
                                })
                            } catch (e) { /* skip */ }

                            // Publications
                            try {
                                const annData: any = await nse.getData(
                                    `https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(sym)}`
                                )
                                const announcements = Array.isArray(annData) ? annData : []

                                let count = 0
                                for (const ann of announcements) {
                                    if (count >= PUB_MAX_PER_TICKER) break
                                    const annDate = parseDate(ann.an_dt || ann.dt)
                                    if (!annDate || annDate < pubCutoff) continue

                                    batchPubs.push({
                                        ticker: sym,
                                        title: ann.desc || ann.subject || 'Announcement',
                                        date: annDate.toISOString(),
                                        pdfUrl: ann.attchmntFile || null,
                                        companyName: ann.sm_name || sym,
                                    })
                                    count++
                                }
                            } catch (e) { /* skip */ }

                            completedSteps++
                        }))

                        // Stream batch results
                        if (batchShockers.length > 0) {
                            accumulated.shockers.push(...batchShockers)
                            send('shockers', batchShockers)
                        }
                        if (batchEvents.length > 0) {
                            accumulated.events.push(...batchEvents)
                            send('events', batchEvents)
                        }
                        if (batchPubs.length > 0) {
                            accumulated.publications.push(...batchPubs)
                            send('publications', batchPubs)
                        }

                        if (i + BATCH < indianTickers.length) await delay(BATCH_DELAY)
                    }
                }

                // Sort accumulated data before caching
                accumulated.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                accumulated.publications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                accumulated.publications = accumulated.publications.slice(0, PUB_TOTAL_LIMIT)
                accumulated.shockers.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio))

                // Save to Supabase cache
                if (userId) {
                    // Don't await — fire and forget so stream closes fast
                    saveCache(userId, portfolioHash, accumulated).catch(() => {})
                }

                send('done', { total: completedSteps })
                controller.close()
            }
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
            }
        })

    } catch (error: any) {
        console.error("Pulse API Error:", error)
        return new Response(JSON.stringify({ type: 'error', data: { message: error.message } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}