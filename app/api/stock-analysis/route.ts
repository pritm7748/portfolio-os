import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

// ════════════════════════════════════════════════════════════════
//  /api/stock-analysis — Multi-source stock analysis endpoint
//  Fetches Yahoo Finance + Screener.in in parallel
// ════════════════════════════════════════════════════════════════

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary'
const YAHOO_MODULES = [
    'financialData', 'defaultKeyStatistics', 'summaryDetail', 'assetProfile',
    'incomeStatementHistoryQuarterly', 'balanceSheetHistoryQuarterly',
    'cashflowStatementHistoryQuarterly', 'majorHoldersBreakdown',
    'insiderTransactions', 'recommendationTrend', 'earningsTrend',
    'upgradeDowngradeHistory', 'earnings'
].join(',')

// ── Helpers ──
const safeNum = (v: any, fallback = 0): number => {
    if (v === null || v === undefined) return fallback
    const n = typeof v === 'object' && v.raw !== undefined ? v.raw : Number(v)
    return isNaN(n) ? fallback : n
}

const cleanNum = (str: string): number => parseFloat(str.replace(/[^\d.\-]/g, '')) || 0

const fmtCrore = (n: number): string => {
    if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr'
    if (n >= 100000) return (n / 100000).toFixed(2) + ' L'
    return n.toLocaleString('en-IN')
}

// ════════════════════════════════════════════════════════════════
//  YAHOO FINANCE FETCH
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

        if (!res.ok) {
            // Try .BO fallback
            if (yahooTicker.endsWith('.NS')) {
                const boTicker = yahooTicker.replace('.NS', '.BO')
                const res2 = await fetch(`${YAHOO_BASE}/${encodeURIComponent(boTicker)}?modules=${YAHOO_MODULES}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    next: { revalidate: 300 }
                })
                if (!res2.ok) return null
                const json2 = await res2.json()
                return json2?.quoteSummary?.result?.[0] || null
            }
            return null
        }

        const json = await res.json()
        return json?.quoteSummary?.result?.[0] || null
    } catch (e) {
        console.error('Yahoo fetch error:', e)
        return null
    }
}

// ════════════════════════════════════════════════════════════════
//  SCREENER.IN FETCH
// ════════════════════════════════════════════════════════════════
async function fetchScreener(symbol: string) {
    try {
        const url = `https://www.screener.in/company/${symbol}/consolidated/`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 300 }
        })

        if (!res.ok) {
            // Try standalone
            const res2 = await fetch(`https://www.screener.in/company/${symbol}/`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 300 }
            })
            if (!res2.ok) return null
            return cheerio.load(await res2.text())
        }

        return cheerio.load(await res.text())
    } catch (e) {
        console.error('Screener fetch error:', e)
        return null
    }
}

// ── Parse Screener top ratios ──
function parseTopRatios($: cheerio.CheerioAPI) {
    const ratios: Record<string, number> = {}
    $('#top-ratios li').toArray().forEach((el) => {
        const name = $(el).find('.name').text().trim().toLowerCase()
        const value = $(el).find('.value, .number').text().trim()
        if (name.includes('roe')) ratios.roe = cleanNum(value)
        else if (name.includes('roce')) ratios.roce = cleanNum(value)
        else if (name.includes('promoter')) ratios.promoterHolding = cleanNum(value)
        else if (name.includes('pledged')) ratios.pledgedPercent = cleanNum(value)
        else if (name.includes('market cap')) ratios.marketCap = cleanNum(value) * 10000000
        else if (name.includes('stock p/e')) ratios.pe = cleanNum(value)
        else if (name.includes('book value')) ratios.bookValue = cleanNum(value)
        else if (name.includes('dividend yield')) ratios.divYield = cleanNum(value)
        else if (name.includes('face value')) ratios.faceValue = cleanNum(value)
    })
    return ratios
}

// ── Parse Screener quarterly results ──
function parseQuarters($: cheerio.CheerioAPI) {
    const quarters: any[] = []
    const table = $('#quarters')
    if (!table.length) return quarters

    const headers: string[] = []
    table.find('thead th').toArray().forEach((th) => headers.push($(th).text().trim()))

    table.find('tbody tr').toArray().forEach((tr) => {
        const cells: string[] = []
        $(tr).find('td').toArray().forEach((td) => cells.push($(td).text().trim()))

        if (cells.length < 2) return

        const label = cells[0]?.toLowerCase() || ''
        if (!label) return

        // Each column (except first) is a quarter
        for (let i = 1; i < cells.length && i < headers.length; i++) {
            if (!quarters[i - 1]) quarters[i - 1] = { period: headers[i] }
            const val = cleanNum(cells[i])

            if (label.includes('sales') || label.includes('revenue')) quarters[i - 1].revenue = val
            else if (label.includes('expenses')) quarters[i - 1].expenses = val
            else if (label.includes('operating profit') && !label.includes('opm')) quarters[i - 1].operatingProfit = val
            else if (label.includes('opm')) quarters[i - 1].opm = val
            else if (label.includes('net profit')) quarters[i - 1].netProfit = val
            else if (label.includes('eps')) quarters[i - 1].eps = val
        }
    })

    return quarters.filter(q => q.period && q.revenue !== undefined).slice(0, 8)
}

// ── Parse Screener balance sheet ──
function parseBalanceSheet($: cheerio.CheerioAPI) {
    const years: any[] = []
    const table = $('#balance-sheet')
    if (!table.length) return years

    const headers: string[] = []
    table.find('thead th').toArray().forEach((th) => headers.push($(th).text().trim()))

    table.find('tbody tr').toArray().forEach((tr) => {
        const cells: string[] = []
        $(tr).find('td').toArray().forEach((td) => cells.push($(td).text().trim()))
        if (cells.length < 2) return

        const label = cells[0]?.toLowerCase() || ''
        for (let i = 1; i < cells.length && i < headers.length; i++) {
            if (!years[i - 1]) years[i - 1] = { period: headers[i] }
            const val = cleanNum(cells[i])

            if (label.includes('share capital') || label === 'equity') years[i - 1].equity = val
            else if (label.includes('reserves')) years[i - 1].reserves = val
            else if (label.includes('borrowings') && !label.includes('other')) years[i - 1].borrowings = val
            else if (label.includes('total liabilities') || label === 'total') {
                if (!years[i - 1].totalLiabilities) years[i - 1].totalLiabilities = val
            }
            else if (label.includes('fixed assets') || label.includes('property')) years[i - 1].fixedAssets = val
            else if (label.includes('investments')) years[i - 1].investments = val
            else if (label.includes('total assets')) years[i - 1].totalAssets = val
        }
    })

    return years.filter(y => y.period).slice(0, 6)
}

// ── Parse Screener cash flow ──
function parseCashFlow($: cheerio.CheerioAPI) {
    const years: any[] = []
    const table = $('#cash-flow')
    if (!table.length) return years

    const headers: string[] = []
    table.find('thead th').toArray().forEach((th) => headers.push($(th).text().trim()))

    table.find('tbody tr').toArray().forEach((tr) => {
        const cells: string[] = []
        $(tr).find('td').toArray().forEach((td) => cells.push($(td).text().trim()))
        if (cells.length < 2) return

        const label = cells[0]?.toLowerCase() || ''
        for (let i = 1; i < cells.length && i < headers.length; i++) {
            if (!years[i - 1]) years[i - 1] = { period: headers[i] }
            const val = cleanNum(cells[i])

            if (label.includes('operating') && label.includes('activit')) years[i - 1].operatingCF = val
            else if (label.includes('investing')) years[i - 1].investingCF = val
            else if (label.includes('financing')) years[i - 1].financingCF = val
            else if (label.includes('net cash') || label.includes('free cash')) years[i - 1].freeCashFlow = val
        }
    })

    return years.filter(y => y.period).slice(0, 6)
}

// ── Parse Screener peers ──
function parsePeers($: cheerio.CheerioAPI) {
    const peers: string[] = []
    $('#peers .data-table tbody tr').toArray().forEach((tr) => {
        const link = $(tr).find('td:first-child a')
        if (link.length) {
            const href = link.attr('href') || ''
            const match = href.match(/\/company\/([^/]+)/)
            if (match) peers.push(match[1])
        }
    })
    return peers.slice(0, 8)
}

// ── Parse Screener shareholding ──
function parseShareholding($: cheerio.CheerioAPI) {
    const data: any[] = []
    const table = $('#shareholding')
    if (!table.length) return data

    const headers: string[] = []
    table.find('thead th').toArray().forEach((th) => headers.push($(th).text().trim()))

    table.find('tbody tr').toArray().forEach((tr) => {
        const cells: string[] = []
        $(tr).find('td').toArray().forEach((td) => cells.push($(td).text().trim()))
        if (cells.length < 2) return

        const label = cells[0]?.toLowerCase() || ''
        for (let i = 1; i < cells.length && i < headers.length; i++) {
            if (!data[i - 1]) data[i - 1] = { period: headers[i] }
            const val = cleanNum(cells[i])

            if (label.includes('promoter')) data[i - 1].promoters = val
            else if (label.includes('fii') || label.includes('foreign')) data[i - 1].fii = val
            else if (label.includes('dii') || label.includes('domestic')) data[i - 1].dii = val
            else if (label.includes('public') || label.includes('retail')) data[i - 1].retail = val
        }
    })

    return data.filter(d => d.period).slice(0, 8)
}

// ── Parse Screener concall links ──
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
    return links.slice(0, 3)
}

// ════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
    try {
        const { ticker } = await request.json()
        if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

        const symbol = ticker.toUpperCase().replace(/\.NS|\.BO/g, '').replace(/\s/g, '')

        // Parallel fetch from Yahoo + Screener
        const [yahoo, $] = await Promise.all([
            fetchYahoo(ticker),
            fetchScreener(symbol)
        ])

        // ── VALUATION (Yahoo primary + Screener enrichment) ──
        const fin = yahoo?.financialData || {}
        const stats = yahoo?.defaultKeyStatistics || {}
        const summary = yahoo?.summaryDetail || {}
        const profile = yahoo?.assetProfile || {}
        const screenerRatios = $ ? parseTopRatios($) : {}

        const valuation = {
            marketCap: safeNum(summary.marketCap) || screenerRatios.marketCap || 0,
            peRatio: safeNum(stats.trailingPE) || screenerRatios.pe || 0,
            forwardPE: safeNum(stats.forwardPE),
            pbRatio: safeNum(stats.priceToBook),
            evEbitda: safeNum(stats.enterpriseToEbitda),
            priceToSales: safeNum(stats.priceToSalesTrailing12Months),
            pegRatio: safeNum(stats.pegRatio),
            roe: screenerRatios.roe || safeNum(fin.returnOnEquity) * 100,
            roce: screenerRatios.roce || 0,
            debtToEquity: safeNum(fin.debtToEquity),
            divYield: safeNum(summary.dividendYield) || (screenerRatios.divYield || 0) / 100,
            high52: safeNum(summary.fiftyTwoWeekHigh),
            low52: safeNum(summary.fiftyTwoWeekLow),
            currentPrice: safeNum(fin.currentPrice) || safeNum(summary.previousClose),
            promoterHolding: screenerRatios.promoterHolding || 0,
            pledgedPercent: screenerRatios.pledgedPercent || 0,
            bookValue: safeNum(stats.bookValue) || screenerRatios.bookValue || 0,
            freeCashFlow: safeNum(fin.freeCashflow),
            revenueGrowth: safeNum(fin.revenueGrowth) * 100,
            earningsGrowth: safeNum(fin.earningsGrowth) * 100,
            operatingMargin: safeNum(fin.operatingMargins) * 100,
            profitMargin: safeNum(fin.profitMargins) * 100,
            sector: profile.sector || 'Unknown',
            industry: profile.industry || 'Unknown',
            beta: safeNum(summary.beta),
            totalRevenue: safeNum(fin.totalRevenue),
            totalDebt: safeNum(fin.totalDebt),
            totalCash: safeNum(fin.totalCash),
            targetMeanPrice: safeNum(fin.targetMeanPrice),
            targetHighPrice: safeNum(fin.targetHighPrice),
            targetLowPrice: safeNum(fin.targetLowPrice),
            recommendationKey: fin.recommendationKey || '',
            numberOfAnalysts: safeNum(fin.numberOfAnalystOpinions),
        }

        // ── QUARTERLY RESULTS (Screener primary, Yahoo fallback) ──
        let quarters = $ ? parseQuarters($) : []
        if (quarters.length === 0 && yahoo?.incomeStatementHistoryQuarterly?.incomeStatementHistory) {
            quarters = yahoo.incomeStatementHistoryQuarterly.incomeStatementHistory.map((q: any) => ({
                period: new Date(safeNum(q.endDate) * 1000).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
                revenue: safeNum(q.totalRevenue) / 10000000,
                operatingProfit: safeNum(q.operatingIncome) / 10000000,
                netProfit: safeNum(q.netIncome) / 10000000,
                eps: safeNum(q.dilutedEPS),
            })).slice(0, 8)
        }

        // ── BALANCE SHEET ──
        let balanceSheet = $ ? parseBalanceSheet($) : []
        if (balanceSheet.length === 0 && yahoo?.balanceSheetHistoryQuarterly?.balanceSheetStatements) {
            balanceSheet = yahoo.balanceSheetHistoryQuarterly.balanceSheetStatements.map((b: any) => ({
                period: new Date(safeNum(b.endDate) * 1000).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
                equity: safeNum(b.commonStock) / 10000000,
                reserves: safeNum(b.retainedEarnings) / 10000000,
                borrowings: safeNum(b.longTermDebt) / 10000000,
                totalAssets: safeNum(b.totalAssets) / 10000000,
            })).slice(0, 6)
        }

        // ── CASH FLOW ──
        let cashFlow = $ ? parseCashFlow($) : []
        if (cashFlow.length === 0 && yahoo?.cashflowStatementHistoryQuarterly?.cashflowStatements) {
            cashFlow = yahoo.cashflowStatementHistoryQuarterly.cashflowStatements.map((c: any) => ({
                period: new Date(safeNum(c.endDate) * 1000).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
                operatingCF: safeNum(c.totalCashFromOperatingActivities) / 10000000,
                investingCF: safeNum(c.totalCashflowsFromInvestingActivities) / 10000000,
                financingCF: safeNum(c.totalCashFromFinancingActivities) / 10000000,
                freeCashFlow: safeNum(c.totalCashFromOperatingActivities + c.capitalExpenditures) / 10000000,
            })).slice(0, 6)
        }

        // ── SHAREHOLDING ──
        const shareholding = $ ? parseShareholding($) : []
        const holdersBreakdown = yahoo?.majorHoldersBreakdown || {}

        // ── INSIDER TRANSACTIONS ──
        const insiderTxns = yahoo?.insiderTransactions?.transactions || []
        const insiderActivity = insiderTxns.slice(0, 10).map((t: any) => ({
            name: t.filerName || 'Unknown',
            relation: t.filerRelation || '',
            date: t.startDate?.fmt || '',
            type: t.transactionText || '',
            shares: safeNum(t.shares),
            value: safeNum(t.value),
        }))

        // ── ANALYST / RECOMMENDATION ──
        const recommendationTrend = yahoo?.recommendationTrend?.trend || []
        const earningsTrend = yahoo?.earningsTrend?.trend || []
        const upgrades = yahoo?.upgradeDowngradeHistory?.history || []

        // ── EARNINGS (Actual vs Estimate) ──
        const earningsHistory = yahoo?.earnings?.earningsChart?.quarterly || []

        // ── PEERS ──
        const peerSymbols = $ ? parsePeers($) : []

        // ── CONCALL LINKS ──
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
        })

    } catch (error: any) {
        console.error('Stock Analysis Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
