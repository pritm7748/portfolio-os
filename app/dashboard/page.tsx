'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import {
    ArrowUpRight, ArrowDownRight, Wallet, Loader2, PiggyBank,
    TrendingUp, DollarSign, Activity, ChevronRight, BarChart3,
    Landmark, Gem, Coins, Grid3X3, Map
} from 'lucide-react'
import DashboardSparkline from '@/components/dashboard-sparkline'
import PortfolioHeatmap from '@/components/portfolio-heatmap'
import PnlDistributionChart from '@/components/pnl-distribution-chart'
import MonthlyReturnsMatrix from '@/components/monthly-returns-matrix'
import { useTransactions, useLivePrices, useDividends } from '@/hooks/use-portfolio-data'

// ════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════
type AssetClassData = {
    invested: number
    current: number
    dayPnl: number
    pnlPercent: number
    sparkData: { value: number }[]
    count: number
}

type HoldingDetail = {
    ticker: string
    currentValue: number
    dayChangePercent: number
    pnlPercent: number
}

// ════════════════════════════════════════════════════════════════
//  HELPER: Format INR
// ════════════════════════════════════════════════════════════════
const getRoot = (t: string) => t.toUpperCase().replace('.NS', '').replace('.BO', '')

const fmtINR = (n: number, compact = false) => {
    if (compact) {
        const abs = Math.abs(n)
        if (abs >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`
        if (abs >= 100000) return `${(n / 100000).toFixed(2)}L`
        if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`
    }
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// ════════════════════════════════════════════════════════════════
//  CLASSIFY ASSET → Stocks | Mutual Funds | Commodities | Currencies
// ════════════════════════════════════════════════════════════════
const classifyAsset = (type: string, ticker: string): string => {
    const t = type?.toLowerCase() || ''
    const tk = ticker?.toUpperCase() || ''
    if (t.includes('mutual') || t.includes('mf') || t.includes('fund')) return 'Mutual Funds'
    if (t.includes('currency') || t.includes('forex') || tk.includes('USD') || tk.includes('EUR')) return 'Currencies'
    if (t.includes('commodity') || t.includes('gold') || t.includes('silver') || tk.startsWith('COMMODITY:')) return 'Commodities'
    return 'Stocks'
}

// ════════════════════════════════════════════════════════════════
//  WEALTH ENGINE CARD
// ════════════════════════════════════════════════════════════════
function WealthCard({ title, icon: Icon, data, accent }: {
    title: string
    icon: any
    data: AssetClassData
    accent: string
}) {
    const isProfit = data.current >= data.invested
    const dayUp = data.dayPnl >= 0
    const pctAlloc = data.invested > 0 ? data.pnlPercent : 0
    const unrealizedPnl = data.current - data.invested

    if (data.count === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 dark:bg-slate-900/50 dark:border-slate-800 flex flex-col justify-center items-center gap-2 opacity-60">
                <div className={`rounded-lg p-1.5 ${accent}`}><Icon className="h-3.5 w-3.5 text-white" /></div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
                <span className="text-[10px] text-slate-400">No assets</span>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col gap-2.5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`rounded-lg p-1.5 ${accent}`}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{title}</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">{data.count} {data.count === 1 ? 'asset' : 'assets'}</span>
            </div>

            <div className="flex items-end justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                        ₹{fmtINR(data.current, true)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Invested: ₹{fmtINR(data.invested, true)}</p>
                </div>
                <div className="w-20 h-10 flex-shrink-0">
                    <DashboardSparkline data={data.sparkData} />
                </div>
            </div>

            {/* Bottom stats row */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {isProfit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isProfit ? '+' : ''}₹{fmtINR(unrealizedPnl, true)} ({isProfit ? '+' : ''}{pctAlloc.toFixed(1)}%)
                </span>
                <span className={`text-[10px] font-medium ${dayUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {dayUp ? '+' : ''}₹{fmtINR(data.dayPnl)} today
                </span>
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════
//  SECTION WRAPPER
// ════════════════════════════════════════════════════════════════
function Section({ title, icon: Icon, children, className = '' }: {
    title: string, icon: any, children: React.ReactNode, className?: string
}) {
    return (
        <div className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 ${className}`}>
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{title}</h3>
            </div>
            <div className="p-5">
                {children}
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function DashboardPage() {
    // 1. Fetch Core Data
    const { data: transactions, isLoading: txnsLoading } = useTransactions()

    // 2. Derive Ticker List
    const allTickers = useMemo(() => {
        if (!transactions) return []
        const set = new Set<string>()
        transactions.forEach(t => set.add(t.assets.ticker))
        return Array.from(set)
    }, [transactions])

    // 3. Fetch Market Data
    const { data: priceMap, isLoading: pricesLoading } = useLivePrices(allTickers)
    const { data: dividendMap, isLoading: divLoading } = useDividends(allTickers)

    const isLoading = txnsLoading || pricesLoading || divLoading

    // 4. THE CALCULATION ENGINE
    const dashData = useMemo(() => {
        if (!transactions || !priceMap || !dividendMap) return null

        const assetLots: Record<string, { price: number, quantity: number }[]> = {}
        const portfolio: Record<string, any> = {}
        let realizedPnL = 0
        let totalIncome = 0
        let dividendCount = 0

        // Process Transactions (FIFO) — aggregate by ROOT symbol to handle cross-exchange trades
        transactions.forEach((txn) => {
            const type = txn.assets.asset_type
            const ticker = txn.assets.ticker
            const root = getRoot(ticker)

            if (txn.transaction_type === 'Dividend' || txn.transaction_type === 'Interest') return
            if (txn.realised_pnl) realizedPnL += Number(txn.realised_pnl)

            if (!assetLots[root]) {
                assetLots[root] = []
                portfolio[root] = { quantity: 0, totalInvested: 0, ticker, type }
            }

            if (txn.transaction_type === 'Buy') {
                assetLots[root].push({ price: Number(txn.price), quantity: Number(txn.quantity) })
            } else if (txn.transaction_type === 'Sell') {
                let qtyToSell = Number(txn.quantity)
                while (qtyToSell > 0 && assetLots[root].length > 0) {
                    if (assetLots[root][0].quantity > qtyToSell) {
                        assetLots[root][0].quantity -= qtyToSell; qtyToSell = 0
                    } else {
                        qtyToSell -= assetLots[root][0].quantity; assetLots[root].shift()
                    }
                }
            }
        })

        // Calculate Holdings
        Object.keys(assetLots).forEach(root => {
            let q = 0, c = 0
            assetLots[root].forEach(lot => { q += lot.quantity; c += (lot.quantity * lot.price) })
            portfolio[root].quantity = q
            portfolio[root].totalInvested = c
        })

        const holdingList = Object.values(portfolio).filter((h: any) => h.quantity > 0.0001)

        // Dividend Calculation
        allTickers.forEach(ticker => {
            const dividends = dividendMap[ticker]
            if (!dividends) return
            const stockTxns = transactions.filter((t) => t.assets.ticker === ticker)
            dividends.forEach((div: any) => {
                const divDate = new Date(div.date)
                let qtyOnDate = 0
                stockTxns.forEach((t) => {
                    if (new Date(t.date) < divDate) {
                        if (t.transaction_type === 'Buy') qtyOnDate += Number(t.quantity)
                        else if (t.transaction_type === 'Sell') qtyOnDate -= Number(t.quantity)
                    }
                })
                if (qtyOnDate > 0) { totalIncome += (qtyOnDate * div.amount); dividendCount++ }
            })
        })

        // Valuation & Classification
        const classes: Record<string, AssetClassData> = {
            'Stocks': { invested: 0, current: 0, dayPnl: 0, pnlPercent: 0, sparkData: [], count: 0 },
            'Mutual Funds': { invested: 0, current: 0, dayPnl: 0, pnlPercent: 0, sparkData: [], count: 0 },
            'Commodities': { invested: 0, current: 0, dayPnl: 0, pnlPercent: 0, sparkData: [], count: 0 },
            'Currencies': { invested: 0, current: 0, dayPnl: 0, pnlPercent: 0, sparkData: [], count: 0 },
        }

        let totalInvested = 0, totalCurrent = 0, totalDayPnl = 0

        const holdingsForHeatmap: HoldingDetail[] = []
        const holdingsForPnl: { ticker: string, pnlPercent: number }[] = []

        holdingList.forEach((h: any) => {
            const cleanTicker = h.ticker.toUpperCase().replace(/\s/g, '')
            let priceData = priceMap[h.ticker]
            if (!priceData) {
                const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
                if (foundKey) priceData = priceMap[foundKey]
            }

            const price = priceData?.price || (h.totalInvested / h.quantity)
            const changePercent = priceData?.change || 0
            const val = h.quantity * price
            const prevPrice = price / (1 + (changePercent / 100))
            const dayChange = (price - prevPrice) * h.quantity
            const pnlPct = h.totalInvested > 0 ? ((val - h.totalInvested) / h.totalInvested) * 100 : 0

            // Classify
            const cls = classifyAsset(h.type, h.ticker)
            classes[cls].invested += h.totalInvested
            classes[cls].current += val
            classes[cls].dayPnl += dayChange
            classes[cls].count++

            totalInvested += h.totalInvested
            totalCurrent += val
            totalDayPnl += dayChange

            holdingsForHeatmap.push({
                ticker: h.ticker,
                currentValue: val,
                dayChangePercent: changePercent,
                pnlPercent: pnlPct,
            })

            holdingsForPnl.push({ ticker: h.ticker, pnlPercent: pnlPct })
        })

        // Compute P&L percent and generate sparklines for each class
        Object.keys(classes).forEach(cls => {
            const c = classes[cls]
            c.pnlPercent = c.invested > 0 ? ((c.current - c.invested) / c.invested) * 100 : 0

            // Generate a simple sparkline from invested → current (interpolated)
            const steps = 12
            const diff = c.current - c.invested
            c.sparkData = Array.from({ length: steps }, (_, i) => {
                // Simulate a path from invested to current with some variance
                const progress = i / (steps - 1)
                const base = c.invested + diff * progress
                const noise = (Math.sin(i * 1.5) * diff * 0.05)
                return { value: Math.max(0, base + noise) }
            })
        })

        const totalPnlPercent = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0
        const dayPnlPercent = totalCurrent > 0 ? (totalDayPnl / (totalCurrent - totalDayPnl)) * 100 : 0

        return {
            totalCurrent,
            totalInvested,
            totalDayPnl,
            dayPnlPercent,
            totalPnlPercent,
            realizedPnl: realizedPnL,
            totalIncome,
            dividendCount,
            classes,
            holdingsForHeatmap,
            holdingsForPnl,
        }
    }, [transactions, priceMap, dividendMap, allTickers])

    // ── LOADING / EMPTY ──
    if (isLoading && !dashData) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
    }
    if (!dashData) {
        return <div className="p-8 text-center text-slate-500">No data found. Add a transaction to get started.</div>
    }

    const dayUp = dashData.totalDayPnl >= 0
    const profitUp = dashData.totalPnlPercent >= 0

    return (
        <div className="space-y-6">

            {/* ═══════════════ ROW 1: SUMMARY CARDS ═══════════════ */}
            <div className="grid gap-4 md:grid-cols-4">

                {/* Net Worth — Hero Card */}
                <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                    <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">Net Worth</p>
                    <h2 className="text-3xl font-bold tracking-tight">₹{fmtINR(dashData.totalCurrent)}</h2>
                    <div className="mt-3 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-md bg-white/10 text-white">
                            {dayUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {dayUp ? '+' : ''}₹{fmtINR(dashData.totalDayPnl)}
                            <span className="text-xs opacity-80">({dayUp ? '+' : ''}{dashData.dayPnlPercent.toFixed(2)}%)</span>
                        </span>
                        <span className="text-indigo-300 text-[10px] uppercase font-medium">Today</span>
                    </div>
                    <p className="text-indigo-300 text-[10px] mt-2">Overall: {profitUp ? '+' : ''}{dashData.totalPnlPercent.toFixed(1)}% return</p>
                </div>

                {/* Total Invested */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Wallet className="h-4 w-4" /></div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invested</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{fmtINR(dashData.totalInvested)}</p>
                    <div className="text-[11px] mt-1.5 space-y-0.5">
                        <p className="flex justify-between">
                            <span className="text-slate-400">Unrealized P&L</span>
                            <span className={`font-bold ${profitUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {profitUp ? '+' : ''}₹{fmtINR(dashData.totalCurrent - dashData.totalInvested)}
                            </span>
                        </p>
                        <p className="flex justify-between">
                            <span className="text-slate-400">Return</span>
                            <span className={`font-bold ${profitUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {profitUp ? '+' : ''}{dashData.totalPnlPercent.toFixed(1)}%
                            </span>
                        </p>
                    </div>
                </div>

                {/* Realized P&L */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"><DollarSign className="h-4 w-4" /></div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Realized P&L</span>
                    </div>
                    <p className={`text-2xl font-bold ${dashData.realizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {dashData.realizedPnl >= 0 ? '+' : ''}₹{fmtINR(dashData.realizedPnl)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1.5">From {dashData.holdingsForPnl.length + (dashData.realizedPnl !== 0 ? ' trades' : ' positions')}</p>
                </div>

                {/* Dividends */}
                <Link
                    href="/dashboard/dividends"
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><PiggyBank className="h-4 w-4" /></div>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dividends</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{fmtINR(dashData.totalIncome)}</p>
                    <div className="text-[11px] mt-1.5 space-y-0.5">
                        <p className="text-slate-400">
                            {dashData.dividendCount > 0 ? `${dashData.dividendCount} payouts detected` : 'No dividends yet'}
                        </p>
                        {dashData.totalInvested > 0 && dashData.totalIncome > 0 && (
                            <p className="flex justify-between">
                                <span className="text-slate-400">Yield</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {((dashData.totalIncome / dashData.totalInvested) * 100).toFixed(2)}%
                                </span>
                            </p>
                        )}
                    </div>
                </Link>
            </div>

            {/* ═══════════════ ROW 2: WEALTH ENGINES ═══════════════ */}
            <div className="grid gap-4 md:grid-cols-4">
                <WealthCard title="Stocks" icon={TrendingUp} data={dashData.classes['Stocks']} accent="bg-indigo-500" />
                <WealthCard title="Mutual Funds" icon={Landmark} data={dashData.classes['Mutual Funds']} accent="bg-sky-500" />
                <WealthCard title="Commodities" icon={Gem} data={dashData.classes['Commodities']} accent="bg-amber-500" />
                <WealthCard title="Currencies" icon={Coins} data={dashData.classes['Currencies']} accent="bg-teal-500" />
            </div>

            {/* ═══════════════ ROW 3: HEATMAP + P&L HISTOGRAM ═══════════════ */}
            <div className="grid gap-6 md:grid-cols-5">
                <Section title="Portfolio Heatmap" icon={Map} className="md:col-span-3">
                    <div className="h-[320px]">
                        <PortfolioHeatmap data={dashData.holdingsForHeatmap} />
                    </div>
                </Section>
                <Section title="P&L Distribution" icon={BarChart3} className="md:col-span-2">
                    <div className="h-[320px]">
                        <PnlDistributionChart data={dashData.holdingsForPnl} />
                    </div>
                </Section>
            </div>

            {/* ═══════════════ ROW 4: MONTHLY RETURNS ═══════════════ */}
            <Section title="Monthly Returns" icon={Grid3X3}>
                <MonthlyReturnsMatrix transactions={transactions || []} priceMap={priceMap || {}} />
            </Section>

        </div>
    )
}