// app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Wallet, PieChart as PieIcon, IndianRupee, Loader2, PiggyBank, Gem, TrendingUp, DollarSign, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AssetAllocationChart from '@/components/asset-allocation-chart'
import MarketStatus from '@/components/market-status'
import { usePortfolio } from '@/context/portfolio-context'

type SummaryStats = {
  invested: number
  current: number
  unrealizedPnl: number
  pnlPercent: number
  dayPnl: number // <--- NEW
}

type DashboardData = {
  total: SummaryStats & { income: number, dividendCount: number, realizedPnl: number }
  equity: SummaryStats
  commodity: SummaryStats
}

type AllocationData = { name: string; value: number }

export default function DashboardPage() {
  const { selectedPortfolio } = usePortfolio()
  const [data, setData] = useState<DashboardData | null>(null)
  const [allocationData, setAllocationData] = useState<AllocationData[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let query = supabase.from('transactions').select(`*, assets ( ticker, asset_type )`).order('date', { ascending: true })
        if (selectedPortfolio.id !== 'all') query = query.eq('portfolio_id', selectedPortfolio.id)

        const { data: transactions } = await query
        if (!transactions) { setLoading(false); return }

        // --- DATA PROCESSING ---
        const assetLots: Record<string, { price: number, quantity: number }[]> = {}
        const portfolio: Record<string, any> = {}
        const allTickers = new Set<string>()
        
        let totalIncome = 0
        let dividendCount = 0
        let realizedPnL = 0 

        transactions.forEach((txn: any) => {
          const type = txn.assets.asset_type
          const ticker = txn.assets.ticker
          allTickers.add(ticker)
          
          if (txn.transaction_type === 'Dividend' || txn.transaction_type === 'Interest') {
              totalIncome += Number(txn.total_value)
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

        Object.keys(assetLots).forEach(ticker => {
            let q = 0, c = 0
            assetLots[ticker].forEach(lot => { q += lot.quantity; c += (lot.quantity * lot.price) })
            portfolio[ticker].quantity = q
            portfolio[ticker].totalInvested = c
        })

        const holdingList = Object.values(portfolio).filter((h: any) => h.quantity > 0)
        const tickersArray = Array.from(allTickers)
        const holdingTickers = holdingList.map((h: any) => h.ticker)

        // FETCH DETAILED PRICES (Price + Change)
        let priceMap: Record<string, { price: number, change: number }> = {}
        let dividendMap: Record<string, any[]> = {}

        if (tickersArray.length > 0) {
            const [priceRes, divRes] = await Promise.all([
                // Note: detailed: true is crucial here
                fetch('/api/prices', { method: 'POST', body: JSON.stringify({ tickers: holdingTickers, detailed: true }) }),
                fetch('/api/dividends', { method: 'POST', body: JSON.stringify({ tickers: tickersArray }) })
            ])
            priceMap = await priceRes.json()
            dividendMap = await divRes.json()
        }

        // --- DIVIDEND LOGIC ---
        tickersArray.forEach(ticker => {
            const dividends = dividendMap[ticker]
            if (!dividends) return
            const stockTxns = transactions.filter((t: any) => t.assets.ticker === ticker)
            dividends.forEach((div: any) => {
                const divDate = new Date(div.date)
                let qtyOnDate = 0
                stockTxns.forEach((t: any) => {
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

        // Buckets & Day P&L
        const equity = { invested: 0, current: 0, dayPnl: 0 }
        const commodity = { invested: 0, current: 0, dayPnl: 0 }
        const typeMap: Record<string, number> = {}

        holdingList.forEach((h: any) => {
            const cleanTicker = h.ticker.toUpperCase().replace(/\s/g, '')
            
            // Get Price Data (Object)
            let priceData = priceMap[h.ticker]
            if (!priceData) {
                const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
                if (foundKey) priceData = priceMap[foundKey]
            }

            const price = priceData?.price || (h.totalInvested / h.quantity)
            const changePercent = priceData?.change || 0

            const val = h.quantity * price
            
            // Calculate Day P&L from Change %
            // If Change is +2%, then PrevPrice = Current / 1.02
            // DayPnL = Current - PrevPrice
            const prevPrice = price / (1 + (changePercent / 100))
            const dayChange = (price - prevPrice) * h.quantity

            const isComm = h.type === 'Commodity' || h.type === 'Currency' || h.type === 'Gold'

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

        setData({ total: totalStats, equity: eqStats, commodity: commStats })
        setAllocationData(Object.keys(typeMap).map(type => ({ name: type, value: typeMap[type] })))

      } catch (error) { console.error("Dashboard Error:", error) } 
      finally { setLoading(false) }
    }
    fetchData()
  }, [selectedPortfolio])

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  if (!data) return <div>Error loading data</div>

  // Updated StatsRow with Day P&L
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
                    <p className="text-lg font-bold text-slate-900 dark:text-white">₹{stats.invested.toLocaleString('en-IN')}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Current</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">₹{stats.current.toLocaleString('en-IN')}</p>
                </div>
                
                {/* Day's P&L Row */}
                <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Day's Change
                    </span>
                    <span className={`font-bold text-sm ${isDayGreen ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isDayGreen ? '+' : ''}₹{stats.dayPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                </div>
                
                {/* Net P&L Row */}
                <div className="col-span-2 flex justify-between items-center">
                    <span className="text-xs text-slate-500">Net P&L</span>
                    <span className={`font-bold ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isProfitable ? '+' : ''}₹{stats.unrealizedPnl.toLocaleString('en-IN')}
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
            <h2 className="text-3xl font-bold">₹{data.total.current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h2>
            <div className="mt-4 flex items-center gap-4 text-sm">
                 <div className="flex items-center gap-1">
                    <span className={data.total.dayPnl >= 0 ? 'text-green-300' : 'text-red-300'}>
                        {data.total.dayPnl >= 0 ? '+' : ''}₹{data.total.dayPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
            <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{data.total.invested.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-1 flex justify-between">
                <span>Unrealized:</span>
                <span className={data.total.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {data.total.unrealizedPnl > 0 ? '+' : ''}{((data.total.unrealizedPnl/data.total.invested)*100).toFixed(1)}%
                </span>
            </p>
         </div>

         {/* Realized P&L */}
         <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"><DollarSign className="h-5 w-5"/></div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Realized P&L</h3>
            </div>
            <p className={`text-2xl font-bold ${data.total.realizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {data.total.realizedPnl >= 0 ? '+' : ''}₹{data.total.realizedPnl.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 mt-1">Booked Profits</p>
         </div>

         {/* Dividend Income */}
         <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><PiggyBank className="h-5 w-5"/></div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">Dividend Income</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{data.total.income.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-1">
                {data.total.dividendCount > 0 ? `${data.total.dividendCount} payouts` : 'No dividends'}
            </p>
         </div>
      </div>

      {/* 2. CATEGORY BREAKDOWN */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4 dark:text-white">Portfolio Breakdown</h3>
        <div className="grid gap-6 md:grid-cols-2">
            <StatsRow title="Equity (Stocks & MF)" icon={TrendingUp} stats={data.equity} colorClass="bg-indigo-500" />
            <StatsRow title="Commodities & Others" icon={Gem} stats={data.commodity} colorClass="bg-amber-500" />
        </div>
      </div>

      {/* 3. CHARTS */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-[400px] rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-2 dark:text-white"><PieIcon className="h-4 w-4 text-slate-500" /> Asset Allocation</h3>
          <div className="flex-1 w-full relative"><AssetAllocationChart data={allocationData} /></div>
        </div>
        <div className="h-[400px] rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 mb-4 dark:text-white">Market Status</h3>
          <div className="flex-1"><MarketStatus /></div>
        </div>
      </div>

    </div>
  )
}