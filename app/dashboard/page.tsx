'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowUpRight, ArrowDownRight, Wallet, PieChart as PieIcon, IndianRupee, Loader2, PiggyBank, Gem, TrendingUp, DollarSign, Activity, ChevronRight } from 'lucide-react'
import AssetAllocationChart from '@/components/asset-allocation-chart'
import MarketStatus from '@/components/market-status'
import { useTransactions, useLivePrices, useDividends } from '@/hooks/use-portfolio-data'
import { usePrivacy } from '@/context/privacy-context' // <--- Import Context

type SummaryStats = {
  invested: number
  current: number
  unrealizedPnl: number
  pnlPercent: number
  dayPnl: number
}

type DashboardData = {
  total: SummaryStats & { income: number, dividendCount: number, realizedPnl: number }
  equity: SummaryStats
  commodity: SummaryStats
}

type AllocationData = { name: string; value: number }

export default function DashboardPage() {
  const { isPrivacyMode } = usePrivacy() // <--- Use Privacy Hook

  // 1. Fetch Core Data (Cached)
  const { data: transactions, isLoading: txnsLoading } = useTransactions()

  // 2. Derive Ticker List
  const allTickers = useMemo(() => {
      if (!transactions) return []
      const set = new Set<string>()
      transactions.forEach(t => set.add(t.assets.ticker))
      return Array.from(set)
  }, [transactions])

  // 3. Fetch Market Data (Cached + Auto-Refresh)
  const { data: priceMap, isLoading: pricesLoading } = useLivePrices(allTickers)
  const { data: dividendMap, isLoading: divLoading } = useDividends(allTickers)

  const isLoading = txnsLoading || pricesLoading || divLoading

  // 4. THE CALCULATION ENGINE (Memoized)
  const { dashboardData, allocationData } = useMemo(() => {
      if (!transactions || !priceMap || !dividendMap) {
          return { dashboardData: null, allocationData: [] }
      }

      const assetLots: Record<string, { price: number, quantity: number }[]> = {}
      const portfolio: Record<string, any> = {}
      
      let totalIncome = 0
      let dividendCount = 0
      let realizedPnL = 0 

      // Step A: Process Transactions (FIFO Logic)
      transactions.forEach((txn) => {
          const type = txn.assets.asset_type
          const ticker = txn.assets.ticker
          
          if (txn.transaction_type === 'Dividend' || txn.transaction_type === 'Interest') {
              return
          }
          
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

      // Step B: Calculate Holdings Summary
      Object.keys(assetLots).forEach(ticker => {
          let q = 0, c = 0
          assetLots[ticker].forEach(lot => { q += lot.quantity; c += (lot.quantity * lot.price) })
          portfolio[ticker].quantity = q
          portfolio[ticker].totalInvested = c
      })

      const holdingList = Object.values(portfolio).filter((h: any) => h.quantity > 0)

      // Step C: Dividend Calculation (Dynamic)
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

      // Step D: Valuation & Day P&L
      const equity = { invested: 0, current: 0, dayPnl: 0 }
      const commodity = { invested: 0, current: 0, dayPnl: 0 }
      const typeMap: Record<string, number> = {}

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

          const isComm = h.type === 'Commodity' || h.type === 'Currency' || h.type === 'Gold' || h.ticker.startsWith('COMMODITY:')

          if (isComm) {
              commodity.invested += h.totalInvested
              commodity.current += val
              commodity.dayPnl += dayChange
          } else {
              equity.invested += h.totalInvested
              equity.current += val
              equity.dayPnl += dayChange
          }

          if (!typeMap[h.type]) typeMap[h.type] = 0
          typeMap[h.type] += val
      })

      const calcStats = (inv: number, curr: number, day: number) => {
          const unrealized = curr - inv
          const pct = inv > 0 ? (unrealized / inv) * 100 : 0
          return { invested: inv, current: curr, unrealizedPnl: unrealized, pnlPercent: pct, dayPnl: day }
      }

      const eqStats = calcStats(equity.invested, equity.current, equity.dayPnl)
      const commStats = calcStats(commodity.invested, commodity.current, commodity.dayPnl)
      
      const totalStats = {
          invested: eqStats.invested + commStats.invested,
          current: eqStats.current + commStats.current,
          unrealizedPnl: eqStats.unrealizedPnl + commStats.unrealizedPnl,
          pnlPercent: (eqStats.invested + commStats.invested) > 0 ? 
              ((eqStats.current + commStats.current - (eqStats.invested + commStats.invested)) / (eqStats.invested + commStats.invested)) * 100 : 0,
          dayPnl: eqStats.dayPnl + commStats.dayPnl,
          income: totalIncome,
          dividendCount,
          realizedPnl: realizedPnL
      }

      return {
          dashboardData: { total: totalStats, equity: eqStats, commodity: commStats },
          allocationData: Object.keys(typeMap).map(type => ({ name: type, value: typeMap[type] }))
      }

  }, [transactions, priceMap, dividendMap, allTickers])


  if (isLoading && !dashboardData) {
      return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  }

  if (!dashboardData) return <div className="p-8 text-center text-slate-500">No data found. Add a transaction to get started.</div>

  // --- HELPER: MASK SENSITIVE DATA ---
  const formatVal = (val: number, isFraction: boolean = false) => {
      if (isPrivacyMode) return '₹****'
      return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: isFraction ? 0 : 0 })
  }

  // Helper for Stats Row
  const StatsRow = ({ title, icon: Icon, stats, colorClass }: any) => {
      const isProfitable = stats.unrealizedPnl >= 0
      const isDayGreen = stats.dayPnl >= 0
      
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`rounded-full p-1.5 ${colorClass} bg-opacity-10`}>
                        <Icon className={`h-4 w-4 ${colorClass.replace('bg-', 'text-')}`} />
                    </div>
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${isProfitable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {isProfitable ? '+' : ''}{stats.pnlPercent.toFixed(2)}%
                </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Invested</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{formatVal(stats.invested)}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Current</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{formatVal(stats.current)}</p>
                </div>
                
                {/* Day's P&L Row */}
                <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Day's Change
                    </span>
                    <span className={`font-bold text-sm ${isDayGreen ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {/* We hide the value but show +/-, actually better to hide all for privacy */}
                        {isPrivacyMode ? '₹****' : (isDayGreen ? '+' : '') + '₹' + stats.dayPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                </div>
                
                {/* Net P&L Row */}
                <div className="col-span-2 flex justify-between items-center">
                    <span className="text-xs text-slate-500">Net P&L</span>
                    <span className={`font-bold ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isPrivacyMode ? '₹****' : (isProfitable ? '+' : '') + '₹' + stats.unrealizedPnl.toLocaleString('en-IN')}
                    </span>
                </div>
            </div>
        </div>
      )
  }

  return (
    <div className="space-y-8">
      
      {/* 1. GRAND TOTALS */}
      <div className="grid gap-4 md:grid-cols-4"> 
         
         {/* Net Worth & Day P&L */}
         <div className="rounded-xl bg-indigo-600 p-6 text-white shadow-lg dark:bg-indigo-700">
            <p className="text-indigo-200 text-sm font-medium mb-1">Total Net Worth</p>
            <h2 className="text-3xl font-bold">{formatVal(dashboardData.total.current, true)}</h2>
            <div className="mt-4 flex items-center gap-4 text-sm">
                 <div className="flex items-center gap-1">
                    <span className={dashboardData.total.dayPnl >= 0 ? 'text-green-300' : 'text-red-300'}>
                        {isPrivacyMode ? '₹****' : (dashboardData.total.dayPnl >= 0 ? '+' : '') + '₹' + dashboardData.total.dayPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-indigo-200 text-xs uppercase">Today</span>
                 </div>
            </div>
         </div>

         {/* Total Invested */}
         <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Wallet className="h-5 w-5"/></div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Total Invested</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatVal(dashboardData.total.invested)}</p>
            <p className="text-xs text-slate-400 mt-1 flex justify-between">
                <span>Unrealized:</span>
                <span className={dashboardData.total.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {dashboardData.total.unrealizedPnl > 0 ? '+' : ''}{((dashboardData.total.unrealizedPnl/dashboardData.total.invested)*100).toFixed(1)}%
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
                {isPrivacyMode ? '₹****' : (dashboardData.total.realizedPnl >= 0 ? '+' : '') + '₹' + dashboardData.total.realizedPnl.toLocaleString('en-IN')}
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
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatVal(dashboardData.total.income)}</p>
            <p className="text-xs text-slate-400 mt-1">
                {dashboardData.total.dividendCount > 0 
                    ? `${dashboardData.total.dividendCount} payouts detected` 
                    : 'No dividends detected yet'}
            </p>
         </Link>
      </div>

      {/* 2. CATEGORY BREAKDOWN */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4 dark:text-white">Portfolio Breakdown</h3>
        <div className="grid gap-6 md:grid-cols-2">
            <StatsRow title="Equity (Stocks & MF)" icon={TrendingUp} stats={dashboardData.equity} colorClass="bg-indigo-500" />
            <StatsRow title="Commodities & Others" icon={Gem} stats={dashboardData.commodity} colorClass="bg-amber-500" />
        </div>
      </div>

      {/* 3. CHARTS */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-[400px] rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-2 dark:text-white"><PieIcon className="h-4 w-4 text-slate-500" /> Asset Allocation</h3>
          <div className="flex-1 w-full relative">
              {/* Optional: Blur chart if privacy is on */}
              <div className={isPrivacyMode ? "blur-md pointer-events-none transition-all duration-300" : "transition-all duration-300"}>
                  <AssetAllocationChart data={allocationData} />
              </div>
          </div>
        </div>
        <div className="h-[400px] rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 mb-4 dark:text-white">Market Status</h3>
          <div className="flex-1"><MarketStatus /></div>
        </div>
      </div>

    </div>
  )
}