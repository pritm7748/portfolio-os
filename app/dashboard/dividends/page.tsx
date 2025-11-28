// app/dashboard/dividends/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ChevronDown, ChevronRight, PiggyBank, TrendingUp, Calendar } from 'lucide-react'
import { usePortfolio } from '@/context/portfolio-context'

type DividendPayout = {
    date: string
    amountPerShare: number
    quantityHeld: number
    totalPayout: number
}

type StockDividendSummary = {
    ticker: string
    name: string
    totalReceived: number
    payouts: DividendPayout[]
    currentValue: number // For yield calculation
    investedValue: number // For yield on cost
}

export default function DividendsPage() {
  const { selectedPortfolio } = usePortfolio()
  const [dividendData, setDividendData] = useState<StockDividendSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)
  const [totalStats, setTotalStats] = useState({ total: 0, yieldOnCost: 0 })

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch Transactions
      let query = supabase
        .from('transactions')
        .select(`*, assets ( ticker, name, asset_type )`)
        .order('date', { ascending: true })

      if (selectedPortfolio.id !== 'all') {
          query = query.eq('portfolio_id', selectedPortfolio.id)
      }

      const { data: transactions } = await query
      if (!transactions) { setLoading(false); return }

      // 2. Identify Tickers & Holdings
      const uniqueTickers = new Set<string>()
      const portfolioCost: Record<string, number> = {} // Cost basis per stock
      
      transactions.forEach((txn: any) => {
          uniqueTickers.add(txn.assets.ticker)
          if (!portfolioCost[txn.assets.ticker]) portfolioCost[txn.assets.ticker] = 0
          
          if (txn.transaction_type === 'Buy') {
              portfolioCost[txn.assets.ticker] += Number(txn.total_value)
          }
      })
      const tickersArray = Array.from(uniqueTickers)

      // 3. Fetch Dividend History
      let dividendMap: Record<string, any[]> = {}
      if (tickersArray.length > 0) {
        const divRes = await fetch('/api/dividends', { method: 'POST', body: JSON.stringify({ tickers: tickersArray }) })
        dividendMap = await divRes.json()
      }

      // 4. Calculate Payouts
      const stockSummaries: StockDividendSummary[] = []
      let grandTotal = 0
      let totalInvested = 0

      tickersArray.forEach(ticker => {
          const dividends = dividendMap[ticker]
          if (!dividends) return // Skip if no dividends found
          
          const stockTxns = transactions.filter((t: any) => t.assets.ticker === ticker)
          const payouts: DividendPayout[] = []
          let stockTotal = 0

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
                  const payout = qtyOnDate * div.amount
                  stockTotal += payout
                  payouts.push({
                      date: div.date,
                      amountPerShare: div.amount,
                      quantityHeld: qtyOnDate,
                      totalPayout: payout
                  })
              }
          })

          // Also check for manually added dividends
          stockTxns.forEach((t: any) => {
              if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
                  const val = Number(t.total_value)
                  stockTotal += val
                  payouts.push({
                      date: t.date,
                      amountPerShare: 0, // Manual entry doesn't track per-share rate usually
                      quantityHeld: 0,
                      totalPayout: val
                  })
              }
          })

          if (stockTotal > 0) {
              stockSummaries.push({
                  ticker,
                  name: stockTxns[0].assets.name,
                  totalReceived: stockTotal,
                  payouts: payouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), // Newest first
                  currentValue: 0, // Could fetch live price if needed for yield
                  investedValue: portfolioCost[ticker] || 0
              })
              grandTotal += stockTotal
              totalInvested += (portfolioCost[ticker] || 0)
          }
      })

      // Sort stocks by highest payer
      stockSummaries.sort((a, b) => b.totalReceived - a.totalReceived)

      setDividendData(stockSummaries)
      setTotalStats({
          total: grandTotal,
          yieldOnCost: totalInvested > 0 ? (grandTotal / totalInvested) * 100 : 0
      })
      setLoading(false)
    }

    fetchData()
  }, [selectedPortfolio])

  const toggleExpand = (ticker: string) => {
      if (expandedTicker === ticker) setExpandedTicker(null)
      else setExpandedTicker(ticker)
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dividend Income</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Track your passive income streams.</p>
          </div>
          
          {/* Summary Stats */}
          <div className="flex gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-w-[160px]">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <PiggyBank className="h-4 w-4 text-emerald-500" /> Total Income
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">₹{totalStats.total.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-w-[160px]">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <TrendingUp className="h-4 w-4 text-blue-500" /> Yield on Cost
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalStats.yieldOnCost.toFixed(2)}%</div>
              </div>
          </div>
      </div>

      {/* Detailed List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        {dividendData.length === 0 ? (
             <div className="p-12 text-center text-slate-400">No dividend income detected yet.</div>
        ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dividendData.map((stock) => (
                    <div key={stock.ticker} className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {/* Main Row */}
                        <div 
                            className="flex items-center justify-between p-5 cursor-pointer"
                            onClick={() => toggleExpand(stock.ticker)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full transition-colors ${expandedTicker === stock.ticker ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'} dark:bg-slate-800 dark:text-slate-400`}>
                                    {expandedTicker === stock.ticker ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{stock.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{stock.ticker}</p>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+₹{stock.totalReceived.toLocaleString('en-IN')}</div>
                                <div className="text-xs text-slate-400">{stock.payouts.length} payouts</div>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedTicker === stock.ticker && (
                            <div className="bg-slate-50 px-5 pb-5 pt-2 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="py-2 font-medium">Payout Date</th>
                                            <th className="py-2 font-medium text-right">Dividend / Share</th>
                                            <th className="py-2 font-medium text-right">Qty Held</th>
                                            <th className="py-2 font-medium text-right">Total Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                                        {stock.payouts.map((payout, i) => (
                                            <tr key={i}>
                                                <td className="py-2 text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                    <Calendar className="h-3 w-3" /> {new Date(payout.date).toLocaleDateString()}
                                                </td>
                                                <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                                    {payout.amountPerShare > 0 ? `₹${payout.amountPerShare}` : '-'}
                                                </td>
                                                <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                                    {payout.quantityHeld > 0 ? payout.quantityHeld : '-'}
                                                </td>
                                                <td className="py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                    +₹{payout.totalPayout.toLocaleString('en-IN')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}