import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { NseIndia } from 'stock-nse-india'

// ════════════════════════════════════════════════════════════════
//  /api/stock-analysis — Multi-source stock analysis endpoint
//  Priority: NSE India (price) → Screener.in (financials) → Yahoo (analyst data)
//
//  Screener section IDs (confirmed via HTML debug):
//    section#peers, section#quarters, section#profit-loss,
//    section#balance-sheet, section#cash-flow, section#ratios,
//    section#shareholding, section#insights
// ════════════════════════════════════════════════════════════════

const nseIndia = new NseIndia()

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary'
const YAHOO_MODULES = [
    'financialData', 'defaultKeyStatistics', 'summaryDetail', 'assetProfile',
    'majorHoldersBreakdown', 'insiderTransactions', 'recommendationTrend',
    'earningsTrend', 'upgradeDowngradeHistory', 'earnings'
].join(',')

// ── Helpers ──
const safeNum = (v: any, fallback = 0): number => {
    if (v === null || v === undefined) return fallback
    const n = typeof v === 'object' && v.raw !== undefined ? v.raw : Number(v)
    return isNaN(n) ? fallback : n
}
const cleanNum = (str: string): number => {
    if (!str) return 0
    // Handle Indian number format (e.g. "8,89,217") and percentages
    return parseFloat(str.replace(/[^\d.\-]/g, '')) || 0
}

// ════════════════════════════════════════════════════════════════
//  SOURCE 1: NSE INDIA (Real-time price + trade info)
// ════════════════════════════════════════════════════════════════
async function fetchNSE(symbol: string) {
    try {
        const [details, tradeInfo] = await Promise.all([
            nseIndia.getEquityDetails(symbol).catch(() => null),
            nseIndia.getEquityTradeInfo(symbol).catch(() => null),
        ])
        return { details, tradeInfo }
    } catch (e) {
        console.warn('NSE fetch failed for', symbol, e)
        return { details: null, tradeInfo: null }
    }
}

// ════════════════════════════════════════════════════════════════
//  SOURCE 2: SCREENER.IN (Quarterly results, balance sheet, etc.)
// ════════════════════════════════════════════════════════════════
async function fetchScreener(symbol: string) {
    try {
        const url = `https://www.screener.in/company/${symbol}/consolidated/`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            next: { revalidate: 300 }
        })
        if (!res.ok) {
            // Try standalone
            const res2 = await fetch(`https://www.screener.in/company/${symbol}/`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                next: { revalidate: 300 }
            })
            if (!res2.ok) return null
            return cheerio.load(await res2.text())
        }
        return cheerio.load(await res.text())
    } catch (e) {
        console.warn('Screener fetch failed for', symbol)
        return null
    }
}

// ── Parse Screener top ratios ──
// Screener HTML: <span class="value">₹ <span class="number">81.6</span></span>
// IMPORTANT: Use span.number for clean values — .value text includes currency/% symbols
function parseTopRatios($: cheerio.CheerioAPI) {
    const ratios: Record<string, number> = {}
    $('#top-ratios li').toArray().forEach((el) => {
        const name = $(el).find('.name').text().trim().toLowerCase()
        // Use span.number for clean numeric value (avoids duplicate text from .value)
        const numberSpans = $(el).find('span.number')
        const firstNum = cleanNum(numberSpans.first().text().trim())

        if (name.includes('market cap')) ratios.marketCap = firstNum * 10000000 // Cr to absolute
        else if (name.includes('current price')) ratios.currentPrice = firstNum
        else if (name.includes('high / low') || name.includes('high/low')) {
            // High/Low has two span.number elements
            if (numberSpans.length >= 2) {
                ratios.high52 = cleanNum($(numberSpans[0]).text().trim())
                ratios.low52 = cleanNum($(numberSpans[1]).text().trim())
            }
        }
        else if (name.includes('stock p/e') || name === 'p/e') ratios.pe = firstNum
        else if (name.includes('book value')) ratios.bookValue = firstNum
        else if (name.includes('dividend yield')) ratios.divYield = firstNum // Already in %
        else if (name.includes('roce')) ratios.roce = firstNum
        else if (name.includes('roe')) ratios.roe = firstNum
        else if (name.includes('face value')) ratios.faceValue = firstNum
        else if (name.includes('promoter') && name.includes('hold')) ratios.promoterHolding = firstNum
        else if (name.includes('pledged')) ratios.pledgedPercent = firstNum
        else if (name.includes('price to book') || name.includes('p/b')) ratios.pb = firstNum
    })

    // Compute P/B if not available
    if (!ratios.pb && ratios.currentPrice && ratios.bookValue && ratios.bookValue > 0) {
        ratios.pb = +(ratios.currentPrice / ratios.bookValue).toFixed(2)
    }

    return ratios
}

// ── Generic Screener table parser ──
// Uses section#ID to find the correct table
function parseScreenerTable($: cheerio.CheerioAPI, sectionId: string): { headers: string[], rows: Record<string, string[]> } {
    const section = $(`section#${sectionId}`)
    if (!section.length) return { headers: [], rows: {} }

    const table = section.find('table').first()
    if (!table.length) return { headers: [], rows: {} }

    const headers: string[] = []
    table.find('thead th, thead td').toArray().forEach((th) => {
        const text = $(th).text().trim()
        if (text) headers.push(text)
    })

    const rows: Record<string, string[]> = {}
    table.find('tbody tr').toArray().forEach((tr) => {
        const cells: string[] = []
        $(tr).find('td').toArray().forEach((td) => cells.push($(td).text().trim()))
        if (cells.length >= 2) {
            // Clean the label (remove + and extra whitespace)
            const label = cells[0].replace(/\s*\+\s*$/, '').trim()
            rows[label] = cells.slice(1)
        }
    })

    return { headers: headers.slice(1), rows } // Skip first empty header column
}

// ── Parse quarterly results ──
function parseQuarters($: cheerio.CheerioAPI) {
    const { headers, rows } = parseScreenerTable($, 'quarters')
    if (!headers.length) return []

    const quarters: any[] = []
    for (let i = 0; i < headers.length; i++) {
        const q: any = { period: headers[i] }
        Object.entries(rows).forEach(([label, vals]) => {
            const lbl = label.toLowerCase()
            const val = cleanNum(vals[i] || '0')
            if (lbl.includes('sales') || lbl.includes('revenue')) q.revenue = val
            else if (lbl === 'expenses') q.expenses = val
            else if (lbl === 'operating profit') q.operatingProfit = val
            else if (lbl.includes('opm')) q.opm = val
            else if (lbl.includes('net profit')) q.netProfit = val
            else if (lbl.includes('eps')) q.eps = val
        })
        if (q.revenue !== undefined || q.netProfit !== undefined) quarters.push(q)
    }
    // Return latest 12 quarters (Screener shows chronologically, latest last)
    return quarters.slice(-12)
}

// ── Parse profit & loss (annual) ──
function parseProfitLoss($: cheerio.CheerioAPI) {
    const { headers, rows } = parseScreenerTable($, 'profit-loss')
    if (!headers.length) return []

    const years: any[] = []
    for (let i = 0; i < headers.length; i++) {
        const y: any = { period: headers[i] }
        Object.entries(rows).forEach(([label, vals]) => {
            const lbl = label.toLowerCase()
            const val = cleanNum(vals[i] || '0')
            if (lbl.includes('sales') || lbl.includes('revenue')) y.revenue = val
            else if (lbl === 'operating profit') y.operatingProfit = val
            else if (lbl.includes('opm')) y.opm = val
            else if (lbl.includes('net profit')) y.netProfit = val
            else if (lbl.includes('eps')) y.eps = val
        })
        if (y.revenue !== undefined) years.push(y)
    }
    return years.slice(-10)
}

// ── Parse balance sheet ──
function parseBalanceSheet($: cheerio.CheerioAPI) {
    const { headers, rows } = parseScreenerTable($, 'balance-sheet')
    if (!headers.length) return []

    const years: any[] = []
    for (let i = 0; i < headers.length; i++) {
        const y: any = { period: headers[i] }
        Object.entries(rows).forEach(([label, vals]) => {
            const lbl = label.toLowerCase()
            const val = cleanNum(vals[i] || '0')
            if (lbl.includes('share capital') || lbl === 'equity capital') y.equity = val
            else if (lbl.includes('reserves')) y.reserves = val
            else if (lbl.includes('borrowings') && !lbl.includes('other')) y.borrowings = val
            else if (lbl.includes('fixed assets') || lbl.includes('property')) y.fixedAssets = val
            else if (lbl.includes('investments') && !lbl.includes('other')) y.investments = val
            else if (lbl.includes('total assets') || (lbl === 'total' && !y.totalAssets)) y.totalAssets = val
        })
        if (Object.keys(y).length > 1) years.push(y)
    }
    return years.slice(-10)
}

// ── Parse cash flow ──
function parseCashFlow($: cheerio.CheerioAPI) {
    const { headers, rows } = parseScreenerTable($, 'cash-flow')
    if (!headers.length) return []

    const years: any[] = []
    for (let i = 0; i < headers.length; i++) {
        const y: any = { period: headers[i] }
        Object.entries(rows).forEach(([label, vals]) => {
            const lbl = label.toLowerCase()
            const val = cleanNum(vals[i] || '0')
            if (lbl.includes('operating') && lbl.includes('activit')) y.operatingCF = val
            else if (lbl.includes('investing') && lbl.includes('activit')) y.investingCF = val
            else if (lbl.includes('financing') && lbl.includes('activit')) y.financingCF = val
            else if (lbl.includes('net cash') || lbl.includes('free cash')) y.freeCashFlow = val
        })
        if (Object.keys(y).length > 1) years.push(y)
    }
    return years.slice(-10)
}

// ── Parse ratios table ──
function parseRatios($: cheerio.CheerioAPI) {
    const { headers, rows } = parseScreenerTable($, 'ratios')
    if (!headers.length) return {}

    // Get latest year values
    const latest: Record<string, number> = {}
    const lastIdx = headers.length - 1

    Object.entries(rows).forEach(([label, vals]) => {
        const lbl = label.toLowerCase()
        const val = cleanNum(vals[lastIdx] || '0')
        if (lbl.includes('debtor')) latest.debtorDays = val
        else if (lbl.includes('inventory')) latest.inventoryDays = val
        else if (lbl.includes('interest cover')) latest.interestCover = val
        else if (lbl.includes('operating profit margin') || lbl === 'opm') latest.opm = val
        else if (lbl.includes('net profit margin') || lbl === 'npm') latest.npm = val
        else if (lbl.includes('return on equity') || lbl === 'roe') latest.roe = val
        else if (lbl.includes('return on capital') || lbl === 'roce') latest.roce = val
        else if (lbl.includes('debt to equity')) latest.debtToEquity = val
        else if (lbl.includes('ev/ebitda') || lbl.includes('enterprise value')) latest.evEbitda = val
        else if (lbl.includes('price to earning') || lbl === 'p/e') latest.pe = val
        else if (lbl.includes('price to book') || lbl === 'p/b') latest.pb = val
    })

    return latest
}

// ── Find peers via industry keyword matching ──
// Screener's section#peers shows industry categories as market links
// We match these to curated peer groups
async function findPeers($: cheerio.CheerioAPI | null, symbol: string): Promise<string[]> {
    const industryPeers: Record<string, string[]> = {
        'IT': ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'MPHASIS'],
        'Banking': ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK', 'BANKBARODA', 'PNB', 'IDFCFIRSTB'],
        'Pharma': ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'LUPIN', 'AUROPHARMA', 'BIOCON', 'TORNTPHARM', 'ALKEM'],
        'Auto': ['MARUTI', 'TATAMOTORS', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'ASHOKLEY', 'TVSMOTOR'],
        'FMCG': ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'GODREJCP', 'COLPAL', 'TATACONSUM'],
        'Oil & Gas': ['RELIANCE', 'ONGC', 'IOC', 'BPCL', 'HINDPETRO', 'GAIL', 'PETRONET', 'MRPL', 'CHENNPETRO'],
        'Metals': ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'NATIONALUM', 'JINDALSTEL', 'SAIL', 'NMDC', 'COALINDIA'],
        'Finance': ['BAJFINANCE', 'BAJAJFINSV', 'HDFCAMC', 'SBILIFE', 'ICICIPRULI', 'MUTHOOTFIN', 'CHOLAFIN', 'SHRIRAMFIN'],
        'Power': ['NTPC', 'POWERGRID', 'TATAPOWER', 'ADANIGREEN', 'NHPC', 'SJVN', 'TORNTPOWER', 'CESC'],
        'Cement': ['ULTRACEMCO', 'SHREECEM', 'AMBUJACEM', 'ACC', 'RAMCOCEM', 'JKCEMENT', 'BIRLACEM', 'JKLAKSHMI'],
        'Telecom': ['BHARTIARTL', 'IDEA', 'TTML', 'HFCL', 'STERLITE'],
        'Real Estate': ['DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'BRIGADE', 'PHOENIXLTD', 'SOBHA'],
        'Insurance': ['LICI', 'SBILIFE', 'HDFCLIFE', 'ICICIPRULI', 'STARHEALTH', 'NIACL', 'GICRE'],
        'Chemical': ['PIDILITIND', 'UPL', 'SRF', 'DEEPAKFERT', 'AARTIIND', 'NAVINFLUOR', 'CLEAN', 'ATUL'],
        'Capital Goods': ['LT', 'SIEMENS', 'ABB', 'HAL', 'BEL', 'BHEL', 'CUMMINSIND', 'THERMAX'],
        'Media': ['ZEEL', 'SUNTV', 'PVRINOX', 'NETWORK18', 'TV18BRDCST', 'SAREGAMA'],
        'Textile': ['PAGEIND', 'TRENT', 'RAYMOND', 'ARVIND', 'KPRMILL', 'GRASIM'],
    }

    const keywords: Record<string, string[]> = {
        'IT': ['software', 'information technology', 'it -', 'computer', 'consulting', 'it services', 'data processing'],
        'Banking': ['bank', 'banking'],
        'Pharma': ['pharma', 'drug', 'healthcare', 'medicine', 'hospital'],
        'Auto': ['auto', 'vehicle', 'motor', 'automobile', '2/3 wheeler', 'passenger car'],
        'FMCG': ['fmcg', 'consumer', 'personal products', 'food', 'household'],
        'Oil & Gas': ['oil', 'gas', 'petroleum', 'refiner', 'energy', 'crude'],
        'Metals': ['metal', 'steel', 'iron', 'alumin', 'mining', 'copper', 'zinc'],
        'Finance': ['finance', 'financial services', 'nbfc', 'lending', 'housing finance', 'microfinance'],
        'Power': ['power', 'electric', 'utility', 'generation', 'transmission'],
        'Cement': ['cement', 'construction material'],
        'Telecom': ['telecom', 'communication', 'wireless'],
        'Real Estate': ['real estate', 'realty', 'housing', 'property', 'construction'],
        'Insurance': ['insurance', 'life insurance'],
        'Chemical': ['chemical', 'fertiliz', 'agrochemical', 'speciality chem'],
        'Capital Goods': ['capital good', 'engineering', 'industrial', 'machinery', 'defence', 'aerospace'],
        'Media': ['media', 'entertainment', 'broadcast', 'film'],
        'Textile': ['textile', 'apparel', 'garment', 'fabric'],
    }

    if ($) {
        // Section is section#peers (confirmed via HTML debug)
        const sectorTexts: string[] = []
        $('section#peers a[href*="/market/"]').toArray().forEach((el) => {
            sectorTexts.push($(el).text().trim().toLowerCase())
        })

        const sectorText = sectorTexts.join(' ')

        for (const [industry, kws] of Object.entries(keywords)) {
            if (kws.some(kw => sectorText.includes(kw))) {
                const peers = industryPeers[industry] || []
                return peers.filter(p => p !== symbol).slice(0, 8)
            }
        }

        // Fallback: Try scraping the Screener sector page for companies
        const sectorHref = $('section#peers a[href*="/market/"]').last().attr('href')
        if (sectorHref) {
            try {
                const sectorUrl = `https://www.screener.in${sectorHref}`
                const sectorRes = await fetch(sectorUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    next: { revalidate: 3600 }
                })
                if (sectorRes.ok) {
                    const $s = cheerio.load(await sectorRes.text())
                    const sectorPeers: string[] = []
                    $s('table tbody tr a[href*="/company/"]').toArray().forEach((el) => {
                        const href = $s(el).attr('href') || ''
                        const match = href.match(/\/company\/([^/]+)/)
                        if (match && match[1]) {
                            const sym = match[1].replace(/\//g, '').toUpperCase()
                            if (/^[A-Z]/.test(sym) && sym.length >= 2 && sym.length <= 20 && sym !== symbol) {
                                sectorPeers.push(sym)
                            }
                        }
                    })
                    if (sectorPeers.length > 0) return [...new Set(sectorPeers)].slice(0, 8)
                }
            } catch { /* fallback failed */ }
        }
    }

    return []
}

// ── Parse shareholding ──
function parseShareholding($: cheerio.CheerioAPI) {
    const { headers, rows } = parseScreenerTable($, 'shareholding')
    if (!headers.length) return []

    const data: any[] = []
    for (let i = 0; i < headers.length; i++) {
        const d: any = { period: headers[i] }
        Object.entries(rows).forEach(([label, vals]) => {
            const lbl = label.toLowerCase()
            const val = cleanNum(vals[i] || '0')
            if (lbl.includes('promoter') && !lbl.includes('pledge')) d.promoters = val
            else if (lbl.includes('fii') || lbl.includes('foreign')) d.fii = val
            else if (lbl.includes('dii') || lbl.includes('domestic')) d.dii = val
            else if (lbl.includes('public') || lbl.includes('retail') || lbl.includes('government')) {
                d.retail = (d.retail || 0) + val
            }
        })
        if (d.promoters !== undefined || d.fii !== undefined) data.push(d)
    }
    return data.slice(-12)
}

// ── Parse concall links ──
function parseConcallLinks($: cheerio.CheerioAPI) {
    const links: { title: string, url: string }[] = []
    $('a').toArray().forEach((el) => {
        const href = $(el).attr('href') || ''
        const text = $(el).text().trim()
        if ((href.includes('concall') || text.toLowerCase().includes('concall') ||
            text.toLowerCase().includes('transcript') || text.toLowerCase().includes('earnings call'))
            && href.startsWith('http')) {
            links.push({ title: text, url: href })
        }
    })
    return links.slice(0, 5)
}

// ════════════════════════════════════════════════════════════════
//  SOURCE 3: YAHOO FINANCE (Fallback for analyst data, insiders)
// ════════════════════════════════════════════════════════════════
async function fetchYahoo(ticker: string) {
    const cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    let yahooTicker = cleanTicker
    if (!yahooTicker.includes('.') && !yahooTicker.includes('^')) yahooTicker += '.NS'

    try {
        const url = `${YAHOO_BASE}/${encodeURIComponent(yahooTicker)}?modules=${YAHOO_MODULES}`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 300 }
        })
        if (!res.ok && yahooTicker.endsWith('.NS')) {
            const boTicker = yahooTicker.replace('.NS', '.BO')
            const res2 = await fetch(`${YAHOO_BASE}/${encodeURIComponent(boTicker)}?modules=${YAHOO_MODULES}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 300 }
            })
            if (!res2.ok) return null
            const json2 = await res2.json()
            return json2?.quoteSummary?.result?.[0] || null
        }
        if (!res.ok) return null
        const json = await res.json()
        return json?.quoteSummary?.result?.[0] || null
    } catch (e) {
        console.warn('Yahoo fetch failed for', ticker)
        return null
    }
}

// ════════════════════════════════════════════════════════════════
//  MAIN HANDLER — Merge all sources intelligently
// ════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
    try {
        const { ticker } = await request.json()
        if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

        const symbol = ticker.toUpperCase().replace(/\.NS|\.BO/g, '').replace(/\s/g, '')

        // Parallel fetch from ALL 3 sources
        const [nse, $, yahoo] = await Promise.all([
            fetchNSE(symbol),
            fetchScreener(symbol),
            fetchYahoo(ticker)
        ])

        // ── EXTRACT NSE DATA ──
        const nseDetails = nse.details as any
        const nseTrade = nse.tradeInfo as any
        const nsePriceInfo = nseDetails?.priceInfo || {}
        const nseSecurityInfo = nseDetails?.securityInfo || {}
        const nseIndustryInfo = nseDetails?.industryInfo || {}

        // ── EXTRACT YAHOO DATA ──
        const fin = yahoo?.financialData || {}
        const stats = yahoo?.defaultKeyStatistics || {}
        const summary = yahoo?.summaryDetail || {}
        const profile = yahoo?.assetProfile || {}

        // ── EXTRACT SCREENER DATA ──
        const screenerRatios = $ ? parseTopRatios($) : {}
        const screenerDetailedRatios = $ ? parseRatios($) : {}

        // ── COMPUTE OPM/NPM from latest quarterly data ──
        const quarters = $ ? parseQuarters($) : []
        let computedOPM = 0
        let computedNPM = 0
        if (quarters.length > 0) {
            const latest = quarters[quarters.length - 1]
            if (latest.revenue && latest.operatingProfit) {
                computedOPM = +(latest.operatingProfit / latest.revenue * 100).toFixed(1)
            }
            if (latest.revenue && latest.netProfit) {
                computedNPM = +(latest.netProfit / latest.revenue * 100).toFixed(1)
            }
        }

        // ── Compute YoY revenue growth from P&L ──
        const profitLoss = $ ? parseProfitLoss($) : []
        let revenueGrowth = 0
        if (profitLoss.length >= 2) {
            const latest = profitLoss[profitLoss.length - 1]
            const prev = profitLoss[profitLoss.length - 2]
            if (latest.revenue && prev.revenue && prev.revenue > 0) {
                revenueGrowth = +((latest.revenue - prev.revenue) / prev.revenue * 100).toFixed(1)
            }
        }

        // ── BALANCE SHEET, CASH FLOW, SHAREHOLDING (parse before valuation for D/E + promoter) ──
        const balanceSheet = $ ? parseBalanceSheet($) : []
        const cashFlow = $ ? parseCashFlow($) : []
        const shareholding = $ ? parseShareholding($) : []
        const holdersBreakdown = yahoo?.majorHoldersBreakdown || {}

        // ── MERGE: VALUATION (NSE primary → Screener → Detailed Ratios → Yahoo fallback) ──
        const currentPrice = nsePriceInfo?.lastPrice || nsePriceInfo?.close ||
            screenerRatios.currentPrice || safeNum(fin.currentPrice) || 0
        const high52 = nsePriceInfo?.weekHighLow?.max || screenerRatios.high52 || safeNum(summary.fiftyTwoWeekHigh)
        const low52 = nsePriceInfo?.weekHighLow?.min || screenerRatios.low52 || safeNum(summary.fiftyTwoWeekLow)

        const valuation = {
            currentPrice,
            marketCap: screenerRatios.marketCap || safeNum(summary.marketCap) || 0,
            peRatio: screenerRatios.pe || screenerDetailedRatios.pe || nseSecurityInfo?.pe || safeNum(stats.trailingPE) || 0,
            forwardPE: safeNum(stats.forwardPE),
            pbRatio: screenerRatios.pb || screenerDetailedRatios.pb || safeNum(stats.priceToBook) || 0,
            evEbitda: screenerDetailedRatios.evEbitda || safeNum(stats.enterpriseToEbitda) || (() => {
                // Compute: EV / EBITDA (TTM)
                // EV = Market Cap + Debt - Cash
                const mcap = screenerRatios.marketCap || safeNum(summary.marketCap) || 0
                const debt = balanceSheet.length > 0 ? (balanceSheet[balanceSheet.length - 1].borrowings || 0) * 1e7 : 0
                const ev = mcap + debt
                // EBITDA ≈ TTM Operating Profit (sum of last 4 quarters)
                if (quarters.length >= 4 && ev > 0) {
                    const last4 = quarters.slice(-4)
                    const ttmOP = last4.reduce((sum: number, q: any) => sum + (q.operatingProfit || 0), 0)
                    if (ttmOP > 0) {
                        const ebitda = ttmOP * 1e7 // Cr → absolute
                        return +((ev / ebitda).toFixed(1))
                    }
                }
                return 0
            })(),
            priceToSales: safeNum(stats.priceToSalesTrailing12Months) || (() => {
                // Compute: MCap / TTM Revenue
                const mcap = screenerRatios.marketCap || safeNum(summary.marketCap) || 0
                if (quarters.length >= 4 && mcap > 0) {
                    const last4 = quarters.slice(-4)
                    const ttmRev = last4.reduce((sum: number, q: any) => sum + (q.revenue || 0), 0)
                    if (ttmRev > 0) {
                        const revAbs = ttmRev * 1e7 // Cr → absolute
                        return +((mcap / revAbs).toFixed(2))
                    }
                }
                return 0
            })(),
            pegRatio: safeNum(stats.pegRatio) || (() => {
                // Compute: P/E / Earnings Growth %
                const pe = screenerRatios.pe || nseSecurityInfo?.pe || 0
                // YoY earnings growth from annual P&L
                if (pe > 0 && profitLoss.length >= 2) {
                    const latest = profitLoss[profitLoss.length - 1]
                    const prev = profitLoss[profitLoss.length - 2]
                    if (latest.netProfit && prev.netProfit && prev.netProfit > 0) {
                        const epsGrowth = ((latest.netProfit - prev.netProfit) / prev.netProfit) * 100
                        if (epsGrowth > 0) return +((pe / epsGrowth).toFixed(2))
                    }
                }
                return 0
            })(),
            roe: screenerRatios.roe || screenerDetailedRatios.roe || safeNum(fin.returnOnEquity) * 100,
            roce: screenerRatios.roce || screenerDetailedRatios.roce || 0,
            // Compute D/E from balance sheet if not in ratios table
            debtToEquity: screenerDetailedRatios.debtToEquity || (() => {
                if (balanceSheet.length > 0) {
                    const latestBS = balanceSheet[balanceSheet.length - 1]
                    const totalEquity = (latestBS.equity || 0) + (latestBS.reserves || 0)
                    if (totalEquity > 0 && latestBS.borrowings) {
                        return +((latestBS.borrowings / totalEquity).toFixed(2))
                    }
                }
                return safeNum(fin.debtToEquity)
            })(),
            // Screener divYield is already in % (e.g. 2.44 = 2.44%)
            divYield: screenerRatios.divYield || (safeNum(summary.dividendYield) > 0 ? safeNum(summary.dividendYield) * 100 : 0),
            high52,
            low52,
            // Promoter holding: try Screener top ratios, then fallback to shareholding data
            promoterHolding: screenerRatios.promoterHolding || (() => {
                if (shareholding.length > 0) {
                    const latest = shareholding[shareholding.length - 1]
                    return latest.promoters || 0
                }
                return 0
            })(),
            pledgedPercent: screenerRatios.pledgedPercent || 0,
            bookValue: screenerRatios.bookValue || safeNum(stats.bookValue) || 0,
            // freeCashFlow computed below with Screener fallback
            revenueGrowth: revenueGrowth || safeNum(fin.revenueGrowth) * 100,
            earningsGrowth: safeNum(fin.earningsGrowth) * 100,
            operatingMargin: screenerDetailedRatios.opm || computedOPM || safeNum(fin.operatingMargins) * 100,
            profitMargin: screenerDetailedRatios.npm || computedNPM || safeNum(fin.profitMargins) * 100,
            sector: nseIndustryInfo?.macro || nseIndustryInfo?.sector || profile.sector || 'Unknown',
            industry: nseIndustryInfo?.basicIndustry || nseIndustryInfo?.industry || profile.industry || 'Unknown',
            beta: safeNum(summary.beta),
            totalRevenue: safeNum(fin.totalRevenue) || (() => {
                if (profitLoss.length > 0) return (profitLoss[profitLoss.length - 1].revenue || 0) * 1e7
                return 0
            })(),
            // Fallback: use balance sheet borrowings for totalDebt (Cr → absolute ₹)
            totalDebt: safeNum(fin.totalDebt) || (() => {
                if (balanceSheet.length > 0) return (balanceSheet[balanceSheet.length - 1].borrowings || 0) * 1e7
                return 0
            })(),
            totalCash: safeNum(fin.totalCash),
            // For DCF: use Operating Cash Flow (standard for DCF valuation)
            // Screener's "Free Cash Flow" = Net Cash Flow (after financing) which is too low
            freeCashFlow: safeNum(fin.freeCashflow) || (() => {
                const cf = $ ? parseCashFlow($) : cashFlow
                if (cf.length > 0) {
                    const latestCF = cf[cf.length - 1]
                    // Use operating CF for DCF (standard practice)
                    return (latestCF.operatingCF || 0) * 1e7
                }
                return 0
            })(),
            targetMeanPrice: safeNum(fin.targetMeanPrice),
            targetHighPrice: safeNum(fin.targetHighPrice),
            targetLowPrice: safeNum(fin.targetLowPrice),
            recommendationKey: fin.recommendationKey || '',
            numberOfAnalysts: safeNum(fin.numberOfAnalystOpinions),
            faceValue: nseSecurityInfo?.faceValue || screenerRatios.faceValue || 0,
        }



        // ── INSIDER TRANSACTIONS (Yahoo) ──
        const insiderTxns = yahoo?.insiderTransactions?.transactions || []
        const insiderActivity = insiderTxns.slice(0, 10).map((t: any) => ({
            name: t.filerName || 'Unknown',
            relation: t.filerRelation || '',
            date: t.startDate?.fmt || '',
            type: t.transactionText || '',
            shares: safeNum(t.shares),
            value: safeNum(t.value),
        }))

        // ── ANALYST DATA (Yahoo) ──
        const recommendationTrend = yahoo?.recommendationTrend?.trend || []
        const earningsTrend = yahoo?.earningsTrend?.trend || []
        const upgrades = yahoo?.upgradeDowngradeHistory?.history || []
        const earningsHistory = yahoo?.earnings?.earningsChart?.quarterly || []

        // ── PEERS (Industry-based) ──
        const peerSymbols = await findPeers($ || null, symbol)

        // ── CONCALL LINKS (Screener) ──
        const concallLinks = $ ? parseConcallLinks($) : []

        return NextResponse.json({
            valuation,
            quarters,
            balanceSheet,
            cashFlow,
            shareholding,
            holdersBreakdown: {
                insidersPercentHeld: safeNum(holdersBreakdown.insidersPercentHeld) * 100,
                institutionsPercentHeld: safeNum(holdersBreakdown.institutionsPercentHeld) * 100,
            },
            insiderActivity,
            recommendationTrend: recommendationTrend.slice(0, 4),
            earningsTrend: earningsTrend.slice(0, 4),
            earningsHistory: earningsHistory.map((e: any) => ({
                period: e.date || '',
                actual: safeNum(e.actual),
                estimate: safeNum(e.estimate),
            })),
            upgrades: upgrades.slice(0, 10).map((u: any) => ({
                date: u.epochGradeDate ? new Date(u.epochGradeDate * 1000).toLocaleDateString() : '',
                firm: u.firm || '',
                toGrade: u.toGrade || '',
                fromGrade: u.fromGrade || '',
                action: u.action || '',
            })),
            peerSymbols,
            concallLinks,
            _sources: {
                nse: !!nseDetails,
                screener: !!$,
                yahoo: !!yahoo,
            }
        })

    } catch (error: any) {
        console.error('Stock Analysis Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
