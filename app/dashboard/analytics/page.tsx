'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateXIRR } from '@/lib/xirr'
import { Loader2, TrendingUp, Info } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { usePortfolio } from '@/context/portfolio-context'
import AIAnalyst from '@/components/ai-analyst' // <--- Import the AI Component

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    xirr: 0,
    totalProfit: 0,
    realizedProfit: 0,
    unrealizedProfit: 0,
    investment: 0,
    currentVal: 0
  })
  const [sectorData, setSectorData] = useState<any[]>([])
  const [aiSummary, setAiSummary] = useState<any>(null) // <--- State for AI Data

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Start Query
      let query = supabase
        .from('transactions')
        .select(`*, assets ( ticker, asset_type )`)
        .order('date', { ascending: true })

      // 2. Apply Filter
      if (selectedPortfolio.id !== 'all') {
          query = query.eq('portfolio_id', selectedPortfolio.id)
      }

      const { data: txns } = await query

      if (!txns) {
          setLoading(false)
          return
      }

      // --- Calculation Logic ---
      const assetLots: Record<string, { price: number, quantity: number }[]> = {}
      const holdingMap: Record<string, number> = {} 
      let realized = 0

      txns.forEach((t: any) => {
        const ticker = t.assets.ticker
        if (t.realised_pnl) realized += Number(t.realised_pnl)

        if (!assetLots[ticker]) assetLots[ticker] = []
        if (!holdingMap[ticker]) holdingMap[ticker] = 0

        if (t.transaction_type === 'Buy') {
            assetLots[ticker].push({ price: Number(t.price), quantity: Number(t.quantity) })
            holdingMap[ticker] += Number(t.quantity)
        } else {
            let qtyToSell = Number(t.quantity)
            holdingMap[ticker] -= qtyToSell
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
      
      // Fetch Prices
      const tickersToFetch = Object.keys(holdingMap).filter(k => holdingMap[k] > 0)
      let priceMap: Record<string, number> = {}

      if (tickersToFetch.length > 0) {
        const res = await fetch('/api/prices', {
            method: 'POST',
            body: JSON.stringify({ tickers: tickersToFetch })
        })
        priceMap = await res.json()
      }

      // Calculate Totals
      let totalInv = 0
      let currentVal = 0
      const sectorMap: Record<string, number> = {}

      Object.keys(assetLots).forEach(ticker => {
          let lotCost = 0
          let lotQty = 0
          assetLots[ticker].forEach(lot => {
              lotCost += (lot.quantity * lot.price)
              lotQty += lot.quantity
          })

          if (lotQty > 0) {
             const cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
             const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
             const price = foundKey ? priceMap[foundKey] : (lotCost / lotQty)
             
             const val = lotQty * price
             totalInv += lotCost 
             currentVal += val

             const type = txns.find((t: any) => t.assets.ticker === ticker)?.assets.asset_type || 'Other'
             if (!sectorMap[type]) sectorMap[type] = 0
             sectorMap[type] += val
          }
      })

      const cashFlows: { amount: number; date: string }[] = []
      txns.forEach((t: any) => {
        if (t.transaction_type === 'Buy') {
            cashFlows.push({ amount: -Number(t.total_value), date: t.date })
        } else {
            cashFlows.push({ amount: (Number(t.price) * Number(t.quantity)), date: t.date })
        }
      })

      const xirr = calculateXIRR(cashFlows, currentVal)

      setMetrics({
        xirr,
        totalProfit: (currentVal + realized) - totalInv,
        realizedProfit: realized,
        unrealizedProfit: currentVal - totalInv,
        investment: totalInv,
        currentVal
      })

      setSectorData(Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })))
      
      // --- PREPARE AI DATA ---
      const topHoldings = Object.keys(holdingMap)
        .filter(ticker => holdingMap[ticker] > 0)
        .map(ticker => ({ ticker, value: holdingMap[ticker] * (priceMap[ticker] || 0) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)

      const aiData = {
          totalValue: currentVal,
          totalProfit: (currentVal + realized) - totalInv,
          xirr: xirr.toFixed(2),
          sectors: Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })),
          holdings: topHoldings
      }
      setAiSummary(aiData)

      setLoading(false)
    }

    fetchData()
  }, [selectedPortfolio])

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-6">
      
      {/* XIRR CARD */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white shadow-lg">
        <div className="flex items-start justify-between">
            <div>
                <div className="flex items-center gap-2 opacity-90">
                    <h3 className="font-medium">Portfolio XIRR</h3>
                    <span title="Extended Internal Rate of Return: Your annualized return rate accounting for time.">
                        <Info className="h-4 w-4 cursor-help" />
                    </span>
                </div>
                <div className="mt-2 text-5xl font-bold tracking-tight">
                    {metrics.xirr.toFixed(2)}%
                </div>
                <p className="mt-2 text-sm text-indigo-100 opacity-80">
                    Annualized return since inception
                </p>
            </div>
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                <TrendingUp className="h-8 w-8 text-white" />
            </div>
        </div>
      </div>

      {/* NEW: AI ANALYST WIDGET */}
      {aiSummary && <AIAnalyst data={aiSummary} />}

      {/* BREAKDOWN CARDS */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Worth</h4>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">₹{metrics.currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Unrealized P&L</h4>
            <div className={`mt-2 text-2xl font-bold ${metrics.unrealizedProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {metrics.unrealizedProfit >= 0 ? '+' : ''}₹{metrics.unrealizedProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Realized P&L (Booked)</h4>
            <div className={`mt-2 text-2xl font-bold ${metrics.realizedProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {metrics.realizedProfit >= 0 ? '+' : ''}₹{metrics.realizedProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart */}
        <div className="h-80 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Allocation by Value (₹)</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <YAxis hide />
                    <Tooltip 
                        cursor={{ fill: '#334155', opacity: 0.1 }}
                        contentStyle={{ borderRadius: '12px', backgroundColor: '#ffffff', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                        itemStyle={{ color: '#0f172a', fontSize: '14px', fontWeight: 'bold' }}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                        formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Value']}
                    />
                    <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
            </ResponsiveContainer>
        </div>

        {/* Text Analysis */}
        <div className="h-80 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Portfolio Health</h3>
            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-500"></div>
                    <div>
                        <span className="block font-medium text-slate-900 dark:text-slate-200">Asset Diversity</span>
                        You are invested in {sectorData.length} different asset classes.
                    </div>
                </li>
                <li className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500"></div>
                    <div>
                        <span className="block font-medium text-slate-900 dark:text-slate-200">Returns</span>
                        Your XIRR of {metrics.xirr.toFixed(2)}% is your true annualized performance.
                    </div>
                </li>
            </ul>
        </div>
      </div>

    </div>
  )
}