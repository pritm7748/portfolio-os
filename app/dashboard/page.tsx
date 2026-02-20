'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Wallet, PiggyBank, DollarSign, Loader2, ChevronRight, Activity, TrendingUp, Gem, Landmark, Coins } from 'lucide-react'
import { useTransactions, useLivePrices, useDividends } from '@/hooks/use-portfolio-data'
import { getReturns } from '@/lib/analytics-math'

// NEW COMPONENTS WE WILL CREATE NEXT
import DashboardSparkline from '@/components/dashboard-sparkline'
import MonthlyReturnsMatrix from '@/components/monthly-returns-matrix'
import PnlDistributionChart from '@/components/pnl-distribution-chart'
import PortfolioHeatmap from '@/components/portfolio-heatmap'

type SummaryStats = {
    invested: number
    current: number
    unrealizedPnl: number
    pnlPercent: number
    dayPnl: number
    dayPnlPercent: number // Added for the (%) display
    history: { date: string, value: number }[] // For Sparklines
}

type HoldingRecord = {
    ticker: string
    type: string
    quantity: number
    avgPrice: number
    invested: number
    currentValue: number
    pnlPercent: number
    dayChangePercent: number
}

export default function DashboardPage() {
    const { data: transactions, isLoading: txnsLoading } = useTransactions()

    const allTickers = useMemo(() => {
        if (!transactions) return []
        return Array.from(new Set(transactions.map(t => t.assets.ticker)))
    }, [transactions])

    const { data: priceMap, isLoading: pricesLoading } = useLivePrices(allTickers)
    const { data: dividendMap, isLoading: divLoading } = useDividends(allTickers)

    const isLoading = txnsLoading || pricesLoading || divLoading

    // --- THE CALCULATION ENGINE ---
    const { dashboardData, holdingsData } = useMemo(() => {
        if (!transactions || !priceMap || !dividendMap) {
            return { dashboardData: null, holdingsData: [] }
        }

        const assetLots: Record<string, { price: number, quantity: number }[]> = {}
        const portfolio: Record<string, any> = {}
        let totalIncome = 0; let dividendCount = 0; let realizedPnL = 0 

        // Step A: Process Transactions (FIFO)
        transactions.forEach((txn) => {
            const type = txn.assets.asset_type
            const ticker = txn.assets.ticker
            
            if (txn.transaction_type === 'Dividend' || txn.transaction_type === 'Interest') return
            if (txn.realised_pnl) realizedPnL += Number(txn.realised_pnl)

            if (!assetLots[ticker]) {
                assetLots[ticker] = []
                portfolio[ticker] = { quantity: 0, totalInvested: 0, ticker, type }
            }

            if (txn.transaction_type === 'Buy') {
                assetLots[ticker].push({ price: Number(txn.price), quantity: Number(txn.quantity) })
            } else if (txn.transaction_type === 'Sell') {
                let qtyToSell = Number(txn.quantity)
                while (qtyToSell > 0 && assetLots[ticker].length > 0) {
                    if (assetLots[ticker][0].quantity > qtyToSell) {
                        assetLots[ticker][0].quantity -= qtyToSell; qtyToSell = 0
                    } else {
                        qtyToSell -= assetLots[ticker][0].quantity; assetLots[ticker].shift()
                    }
                }
            }
        })

        Object.keys(assetLots).forEach(ticker => {
            let q = 0, c = 0
            assetLots[ticker].forEach(lot => { q += lot.quantity; c += (lot.quantity * lot.price) })
            portfolio[ticker].quantity = q
            portfolio[ticker].totalInvested = c
        })

        const holdingList = Object.values(portfolio).filter((h: any) => h.quantity > 0)

        // Step B: Dividend Calc
        allTickers.forEach(ticker => {
            const dividends = dividendMap[ticker]
            if (!dividends) return
            const stockTxns = transactions.filter((t) => t.assets.ticker === ticker)
            
            dividends.forEach((div: any) => {
                const divDate = new Date(div.date)
                let qtyOnDate = 0
                stockTxns.forEach((t) => {
                    const txnDate = new Date(t.date)
                    if (txnDate < divDate) {
                        if (t.transaction_type === 'Buy') qtyOnDate += Number(t.quantity)
                        else if (t.transaction_type === 'Sell') qtyOnDate -= Number(t.quantity)
                    }
                })
                if (qtyOnDate > 0) {
                    totalIncome += (qtyOnDate * div.amount)
                    dividendCount++
                }
            })
        })

        // Step C: Valuation & Bucketing
        const buckets = {
            stocks: { invested: 0, current: 0, dayPnl: 0 },
            mfs: { invested: 0, current: 0, dayPnl: 0 },
            comm: { invested: 0, current: 0, dayPnl: 0 },
            curr: { invested: 0, current: 0, dayPnl: 0 }
        }

        const holdingsListForChart: HoldingRecord[] = []

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

            holdingsListForChart.push({
                ticker: h.ticker, type: h.type, quantity: h.quantity, avgPrice: h.totalInvested / h.quantity,
                invested: h.totalInvested, currentValue: val, pnlPercent: pnlPct, dayChangePercent: changePercent
            })

            let category = 'stocks'
            if (h.type.toLowerCase().includes('mutual')) category = 'mfs'
            else if (h.type.toLowerCase().includes('commodity') || h.type.toLowerCase().includes('gold') || h.type.toLowerCase().includes('silver')) category = 'comm'
            else if (h.type.toLowerCase().includes('currency')) category = 'curr'

            buckets[category as keyof typeof buckets].invested += h.totalInvested
            buckets[category as keyof typeof buckets].current += val
            buckets[category as keyof typeof buckets].dayPnl += dayChange
        })

        const calcStats = (b: any): SummaryStats => {
            const unrealized = b.current - b.invested
            const pct = b.invested > 0 ? (unrealized / b.invested) * 100 : 0
            const prevTotal = b.current - b.dayPnl
            const dayPct = prevTotal > 0 ? (b.dayPnl / prevTotal) * 100 : 0
            
            // Generate dummy 7-day sparkline history based on today's volatility (since we don't fetch full history here to save load time)
            // In a real app, you'd fetch /api/history for these specific categories.
            const dummyHistory = Array.from({length: 7}).map((_, i) => ({
                date: `Day ${i}`, 
                value: b.current * (1 - (Math.random() * 0.02) + (Math.random() * 0.02))
            }))
            dummyHistory[6].value = b.current // End on today's real value

            return { invested: b.invested, current: b.current, unrealizedPnl: unrealized, pnlPercent: pct, dayPnl: b.dayPnl, dayPnlPercent: dayPct, history: dummyHistory }
        }

        const stats = {
            stocks: calcStats(buckets.stocks),
            mfs: calcStats(buckets.mfs),
            comm: calcStats(buckets.comm),
            curr: calcStats(buckets.curr)
        }

        const tInv = buckets.stocks.invested + buckets.mfs.invested + buckets.comm.invested + buckets.curr.invested
        const tCur = buckets.stocks.current + buckets.mfs.current + buckets.comm.current + buckets.curr.current
        const tDay = buckets.stocks.dayPnl + buckets.mfs.dayPnl + buckets.comm.dayPnl + buckets.curr.dayPnl
        const tPrev = tCur - tDay
        const tDayPct = tPrev > 0 ? (tDay / tPrev) * 100 : 0

        const totalStats = {
            invested: tInv,
            current: tCur,
            unrealizedPnl: tCur - tInv,
            pnlPercent: tInv > 0 ? ((tCur - tInv) / tInv) * 100 : 0,
            dayPnl: tDay,
            dayPnlPercent: tDayPct,
            income: totalIncome,
            dividendCount,
            realizedPnl: realizedPnL
        }

        return {
            dashboardData: { total: totalStats, engines: stats },
            holdingsData: holdingsListForChart
        }

    }, [transactions, priceMap, dividendMap, allTickers])


    if (isLoading && !dashboardData) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
    }

    if (!dashboardData) return <div className="p-8 text-center text-slate-500">No data found. Add a transaction to get started.</div>

    // Engine Card Helper
    const EngineCard = ({ title, icon: Icon, stats, colorClass }: any) => {
        if (stats.invested === 0) return null // Hide if empty

        const isDayGreen = stats.dayPnl >= 0
        const isOverallGreen = stats.unrealizedPnl >= 0
        const colorPrefix = colorClass.split('-')[1] // e.g. 'indigo', 'amber'

        return (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between group hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-md bg-${colorPrefix}-100 text-${colorPrefix}-600 dark:bg-${colorPrefix}-900/30 dark:text-${colorPrefix}-400`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{title}</h3>
                </div>
                
                <div className="mb-4">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">₹{stats.current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <div className="flex items-center gap-3 text-[10px] mt-1">
                        <span className={`font-semibold ${isDayGreen ? 'text-green-600' : 'text-red-600'}`}>
                            {isDayGreen ? '+' : ''}₹{Math.abs(stats.dayPnl).toFixed(0)} (Today)
                        </span>
                        <span className={`font-semibold ${isOverallGreen ? 'text-green-600' : 'text-red-600'}`}>
                            {isOverallGreen ? '+' : ''}{stats.pnlPercent.toFixed(1)}% (Net)
                        </span>
                    </div>
                </div>

                <div className="h-10 w-full mt-auto opacity-70 group-hover:opacity-100 transition-opacity">
                    <DashboardSparkline data={stats.history} color={`var(--color-${colorPrefix}-500, #6366f1)`} />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-10">
            
            {/* 1. TOP SNAPSHOT ROW */}
            <div className="grid gap-4 md:grid-cols-4"> 
                {/* Net Worth */}
                <div className="rounded-xl bg-indigo-600 p-6 text-white shadow-lg dark:bg-indigo-700">
                    <p className="text-indigo-200 text-sm font-medium mb-1">Total Net Worth</p>
                    <h2 className="text-3xl font-bold">₹{dashboardData.total.current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h2>
                    <div className="mt-4 flex items-center gap-4 text-sm">
                         <div className="flex items-center gap-1">
                            <span className={dashboardData.total.dayPnl >= 0 ? 'text-green-300' : 'text-red-300'}>
                                {dashboardData.total.dayPnl >= 0 ? '+' : ''}₹{Math.abs(dashboardData.total.dayPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({Math.abs(dashboardData.total.dayPnlPercent).toFixed(2)}%)
                            </span>
                            <span className="text-indigo-200 text-xs uppercase ml-1">Today</span>
                         </div>
                    </div>
                </div>

                {/* Total Invested */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Wallet className="h-5 w-5"/></div>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Total Invested</h3>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{dashboardData.total.invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-slate-400 mt-1 flex justify-between">
                        <span>Unrealized:</span>
                        <span className={dashboardData.total.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {dashboardData.total.unrealizedPnl >= 0 ? '+' : ''}{dashboardData.total.pnlPercent.toFixed(1)}%
                        </span>
                    </p>
                </div>

                {/* Realized P&L */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"><DollarSign className="h-5 w-5"/></div>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Realized P&L</h3>
                    </div>
                    <p className={`text-2xl font-bold ${dashboardData.total.realizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {dashboardData.total.realizedPnl >= 0 ? '+' : ''}₹{dashboardData.total.realizedPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Booked Profits</p>
                </div>

                {/* Dividend Income */}
                <Link 
                    href="/dashboard/dividends"
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <PiggyBank className="h-5 w-5"/>
                            </div>
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Dividend Income</h3>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{dashboardData.total.income.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-slate-400 mt-1">
                        {dashboardData.total.dividendCount > 0 
                            ? `${dashboardData.total.dividendCount} payouts detected` 
                            : 'No dividends detected yet'}
                    </p>
                </Link>
            </div>

            {/* 2. WEALTH ENGINES (Replaces old breakdown & pie chart) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <EngineCard title="Direct Equity" icon={TrendingUp} stats={dashboardData.engines.stocks} colorClass="bg-indigo-500" />
                <EngineCard title="Mutual Funds" icon={Landmark} stats={dashboardData.engines.mfs} colorClass="bg-sky-500" />
                <EngineCard title="Commodities" icon={Gem} stats={dashboardData.engines.comm} colorClass="bg-amber-500" />
                <EngineCard title="Currencies" icon={Coins} stats={dashboardData.engines.curr} colorClass="bg-emerald-500" />
            </div>

            {/* 3. DATA COCKPIT (Middle Row) */}
            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-1">P&L Distribution</h3>
                    <p className="text-xs text-slate-500 mb-6">Concentration of your winners vs losers.</p>
                    <div className="h-64">
                        <PnlDistributionChart data={holdingsData} />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-1">Monthly Returns Matrix</h3>
                    <p className="text-xs text-slate-500 mb-4">Historical performance breakdown.</p>
                    <div className="flex-1 min-h-[250px]">
                        <MonthlyReturnsMatrix transactions={transactions || []} priceMap={priceMap || {}} />
                    </div>
                </div>
            </div>

            {/* --- NEW: 4. PORTFOLIO HEATMAP (Bottom Full Width) --- */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Live Heatmap</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Block size represents total value. Color represents today's movement.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-600 rounded-sm"></div> &lt; -2%</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded-sm"></div> Negative</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-400 rounded-sm"></div> Positive</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-600 rounded-sm"></div> &gt; 2%</div>
                    </div>
                </div>
                <div className="h-[450px] w-full rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800">
                    <PortfolioHeatmap data={holdingsData} />
                </div>
            </div>

        </div>
    )
}