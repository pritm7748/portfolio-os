'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Wallet, PieChart as PieIcon, IndianRupee, Loader2, PiggyBank } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AssetAllocationChart from '@/components/asset-allocation-chart'
import MarketStatus from '@/components/market-status'
import { usePortfolio } from '@/context/portfolio-context'

type DashboardSummary = {
  totalInvestment: number
  currentValue: number
  overallPnL: number
  pnlPercent: number
  totalIncome: number
}

type AllocationData = { name: string; value: number }

export default function DashboardPage() {
  const { selectedPortfolio } = usePortfolio()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
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

        // --- CORE LOGIC START ---
        const assetLots: Record<string, { price: number, quantity: number }[]> = {}
        const portfolio: Record<string, any> = {}
        const allTickers = new Set<string>()
        
        let totalRealized = 0 

        // 1. Process Transactions (FIFO)
        transactions.forEach((txn: any) => {
          const ticker = txn.assets.ticker
          allTickers.add(ticker) // Collect unique tickers

          if (txn.realised_pnl) totalRealized += Number(txn.realised_pnl)

          if (!assetLots[ticker]) {
              assetLots[ticker] = []
              portfolio[ticker] = { quantity: 0, totalInvested: 0, ticker, type: txn.assets.asset_type }
          }

          if (txn.transaction_type === 'Buy') {
            assetLots[ticker].push({ price: Number(txn.price), quantity: Number(txn.quantity) })
          } else if (txn.transaction_type === 'Sell') {
            let qtyToSell = Number(txn.quantity)
            while (qtyToSell > 0 && assetLots[ticker].length > 0) {
                const oldestLot = assetLots[ticker][0]
                if (oldestLot.quantity > qtyToSell) {
                    oldestLot.quantity -= qtyToSell
                    qtyToSell = 0
                } else {
                    qtyToSell -= oldestLot.quantity
                    assetLots[ticker].shift()
                }
            }
          }
        })

        // 2. Calculate Current Holdings
        Object.keys(assetLots).forEach(ticker => {
            let totalQty = 0
            let totalCost = 0
            assetLots[ticker].forEach(lot => {
                totalQty += lot.quantity
                totalCost += (lot.quantity * lot.price)
            })
            portfolio[ticker].quantity = totalQty
            portfolio[ticker].totalInvested = totalCost
        })

        const holdingList = Object.values(portfolio).filter((h: any) => h.quantity > 0)
        const tickers = Array.from(allTickers)

        // 3. Fetch Prices & Dividends in Parallel
        const [priceRes, divRes] = await Promise.all([
            fetch('/api/prices', { method: 'POST', body: JSON.stringify({ tickers }) }),
            fetch('/api/dividends', { method: 'POST', body: JSON.stringify({ tickers }) })
        ])

        const priceMap = await priceRes.json()
        const dividendMap = await divRes.json()

        // 4. Calculate Totals
        let totalInvestment = 0
        let currentValue = 0
        let totalDividends = 0 // Auto-calculated Income
        const typeMap: Record<string, number> = {}

        // A. Calculate Portfolio Value
        holdingList.forEach((h: any) => {
            const cleanTicker = h.ticker.toUpperCase().replace(/\s/g, '')
            const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
            const price = foundKey ? priceMap[foundKey] : (h.totalInvested / h.quantity)
            
            h.currentValue = h.quantity * price
            totalInvestment += h.totalInvested
            currentValue += h.currentValue

            if (!typeMap[h.type]) typeMap[h.type] = 0
            typeMap[h.type] += h.currentValue
        })

        // B. Calculate Dividend Income (The Magic Part)
        // Loop through every stock we have ever touched
        tickers.forEach(ticker => {
            const dividends = dividendMap[ticker]
            if (!dividends) return

            // Get all transactions for this ticker
            const stockTxns = transactions.filter((t: any) => t.assets.ticker === ticker)
            
            // For each dividend event, check our balance on that date
            dividends.forEach((div: any) => {
                const divDate = new Date(div.date)
                let qtyOnDate = 0

                stockTxns.forEach((t: any) => {
                    const txnDate = new Date(t.date)
                    // If transaction happened BEFORE dividend date, it counts
                    if (txnDate < divDate) {
                        if (t.transaction_type === 'Buy') qtyOnDate += Number(t.quantity)
                        else if (t.transaction_type === 'Sell') qtyOnDate -= Number(t.quantity)
                    }
                })

                if (qtyOnDate > 0) {
                    totalDividends += (qtyOnDate * div.amount)
                }
            })
        })

        const chartData = Object.keys(typeMap).map(type => ({ name: type, value: typeMap[type] }))

        const unrealizedPnL = currentValue - totalInvestment
        const overallPnL = unrealizedPnL + totalRealized

        setSummary({
            totalInvestment,
            currentValue,
            overallPnL, 
            pnlPercent: totalInvestment > 0 ? (unrealizedPnL / totalInvestment) * 100 : 0,
            totalIncome: totalDividends // <--- Now fully automatic!
        })
        setAllocationData(chartData)

      } catch (error) { console.error("Dashboard Error:", error) } 
      finally { setLoading(false) }
    }

    fetchData()
  }, [selectedPortfolio])

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  if (!summary) return <div>Error loading data</div>

  const isProfitable = summary.overallPnL >= 0

  return (
    <div className="space-y-6">
      
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        
        {/* Total Investment */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Investment</h3>
            <div className="rounded-full bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"><Wallet className="h-5 w-5" /></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">₹{summary.totalInvestment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Portfolio Value */}
        <div className="rounded-xl bg-indigo-600 p-6 shadow-lg text-white dark:bg-indigo-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-indigo-100">Portfolio Value</h3>
            <IndianRupee className="h-5 w-5 text-indigo-200" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">₹{summary.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Overall P&L */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total P&L</h3>
            <div className={`rounded-full p-2 ${isProfitable ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
              {isProfitable ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-2xl font-bold ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isProfitable ? '+' : ''}₹{summary.overallPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <span className="ml-2 text-xs text-slate-400">{summary.pnlPercent.toFixed(2)}%</span>
          </div>
        </div>

        {/* Total Income (AUTO) */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Income</h3>
            <div className="rounded-full bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"><PiggyBank className="h-5 w-5" /></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                +₹{summary.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <p className="mt-1 text-xs text-slate-400">Dividends</p>
          </div>
        </div>

      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-[450px] rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-2 dark:text-white"><PieIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" /> Asset Allocation</h3>
          <div className="flex-1 w-full relative"><AssetAllocationChart data={allocationData} /></div>
        </div>
        <div className="h-[450px] rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 mb-4 dark:text-white">Market Status</h3>
          <div className="flex-1"><MarketStatus /></div>
        </div>
      </div>
    </div>
  )
}