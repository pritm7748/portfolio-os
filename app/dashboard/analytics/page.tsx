'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateXIRR } from '@/lib/xirr'
import { Loader2, TrendingUp, Info, Gem, BarChart3 } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { usePortfolio } from '@/context/portfolio-context'
import AIAnalyst from '@/components/ai-analyst'

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalXirr: 0,
    equityXirr: 0,
    commXirr: 0,
    netWorth: 0,
    unrealized: 0,
    realized: 0,
    totalProfit: 0,
    investment: 0,
    currentVal: 0,
    xirr: 0 
  })
  const [sectorData, setSectorData] = useState<any[]>([])
  const [aiSummary, setAiSummary] = useState<any>(null)

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch Transactions
      let query = supabase
        .from('transactions')
        .select(`*, assets ( ticker, asset_type )`)
        .order('date', { ascending: true })

      if (selectedPortfolio.id !== 'all') {
          query = query.eq('portfolio_id', selectedPortfolio.id)
      }

      const { data: txns } = await query

      if (!txns) {
          setLoading(false)
          return
      }

      // --- Data Processing ---
      const assetLots: Record<string, any[]> = {}
      const holdingMap: Record<string, number> = {} 
      const allTickers = new Set<string>()
      let totalRealized = 0
      let totalDividends = 0

      // XIRR Flows Arrays
      const flowsTotal: any[] = []
      const flowsEquity: any[] = []
      const flowsComm: any[] = []

      txns.forEach((t: any) => {
        const ticker = t.assets.ticker
        const type = t.assets.asset_type
        const isComm = type === 'Commodity' || type === 'Currency' || type === 'Gold'
        allTickers.add(ticker)

        if (t.realised_pnl) totalRealized += Number(t.realised_pnl)
        if (!assetLots[ticker]) assetLots[ticker] = []
        if (!holdingMap[ticker]) holdingMap[ticker] = 0

        // Calculate Transaction Value manually to be safe
        const txnValue = Math.abs(Number(t.price) * Number(t.quantity))

        // --- HOLDINGS & CASHFLOW LOGIC ---
        if (t.transaction_type === 'Buy') {
            assetLots[ticker].push({ price: Number(t.price), quantity: Number(t.quantity) })
            holdingMap[ticker] += Number(t.quantity)
            
            // Cashflow OUT (Negative)
            const flow = { amount: -txnValue, date: t.date }
            flowsTotal.push(flow)
            if (isComm) flowsComm.push(flow)
            else flowsEquity.push(flow)

        } else if (t.transaction_type === 'Sell') {
            let qty = Number(t.quantity)
            holdingMap[ticker] -= qty
            
            // FIFO Consume (for cost basis tracking)
            while (qty > 0 && assetLots[ticker].length > 0) {
                const oldestLot = assetLots[ticker][0]
                if (oldestLot.quantity > qty) {
                    oldestLot.quantity -= qty
                    qty = 0
                } else {
                    qty -= oldestLot.quantity
                    assetLots[ticker].shift()
                }
            }
            
            // Cashflow IN (Positive)
            const flow = { amount: txnValue, date: t.date }
            flowsTotal.push(flow)
            if (isComm) flowsComm.push(flow)
            else flowsEquity.push(flow)
        } 
        else if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
            const incomeAmt = Number(t.total_value)
            totalDividends += incomeAmt
            
            // Cashflow IN (Positive)
            const flow = { amount: incomeAmt, date: t.date }
            flowsTotal.push(flow)
            if (isComm) flowsComm.push(flow)
            else flowsEquity.push(flow)
        }
      })
      
      // Fetch Prices & Dividends
      const tickersArray = Array.from(allTickers)
      const tickersToFetchPrice = Object.keys(holdingMap).filter(k => holdingMap[k] > 0)

      let priceMap: Record<string, number> = {}
      let dividendMap: Record<string, any[]> = {}

      if (tickersArray.length > 0) {
        const [priceRes, divRes] = await Promise.all([
             fetch('/api/prices', { method: 'POST', body: JSON.stringify({ tickers: tickersToFetchPrice }) }),
             fetch('/api/dividends', { method: 'POST', body: JSON.stringify({ tickers: tickersArray }) })
        ])
        priceMap = await priceRes.json()
        dividendMap = await divRes.json()
      }

      // --- AUTO DIVIDEND CALCULATION ---
      tickersArray.forEach(ticker => {
          const dividends = dividendMap[ticker]
          if (!dividends) return
          const stockTxns = txns.filter((t: any) => t.assets.ticker === ticker)
          
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
                  const divAmount = qtyOnDate * div.amount
                  totalDividends += divAmount
                  
                  // Add Dividend to XIRR Flows (Positive)
                  const flow = { amount: divAmount, date: div.date }
                  flowsTotal.push(flow)
                  flowsEquity.push(flow) 
              }
          })
      })

      // Calculate Current Values
      let valTotal = 0, valEq = 0, valComm = 0
      let fifoCostTotal = 0
      const sectorMap: Record<string, number> = {}

      Object.keys(assetLots).forEach(ticker => {
          let lotCost = 0
          let lotQty = 0
          assetLots[ticker].forEach(lot => {
              lotCost += (lot.quantity * lot.price)
              lotQty += lot.quantity
          })

          if (lotQty > 0) {
             const clean = ticker.toUpperCase().replace(/\s/g, '')
             const foundKey = Object.keys(priceMap).find(k => k.includes(clean.split('.')[0]))
             const price = foundKey ? priceMap[foundKey] : (lotCost / lotQty)
             
             const val = lotQty * price
             valTotal += val
             fifoCostTotal += lotCost

             const type = txns.find((t: any) => t.assets.ticker === ticker)?.assets.asset_type || 'Other'
             const isComm = type === 'Commodity' || type === 'Currency' || type === 'Gold'
             
             if (isComm) valComm += val
             else valEq += val

             if (!sectorMap[type]) sectorMap[type] = 0
             sectorMap[type] += val
          }
      })

      // --- XIRR CALCULATION (FIXED: Check for empty flows) ---
      const xirrTotal = (flowsTotal.length > 0 || valTotal > 0) ? calculateXIRR(flowsTotal, valTotal) : 0
      const xirrEq = (flowsEquity.length > 0 || valEq > 0) ? calculateXIRR(flowsEquity, valEq) : 0
      const xirrComm = (flowsComm.length > 0 || valComm > 0) ? calculateXIRR(flowsComm, valComm) : 0

      const unrealizedPnL = valTotal - fifoCostTotal
      const totalRealizedProfit = totalRealized + totalDividends
      const totalPnL = unrealizedPnL + totalRealizedProfit

      setMetrics({
        totalXirr: xirrTotal,
        equityXirr: xirrEq,
        commXirr: xirrComm,
        netWorth: valTotal,
        unrealized: unrealizedPnL,
        realized: totalRealizedProfit,
        totalProfit: totalPnL,
        investment: fifoCostTotal,
        currentVal: valTotal,
        xirr: xirrTotal 
      })

      setSectorData(Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })))
      
      // AI Data
      const topHoldings = Object.keys(holdingMap)
        .filter(ticker => holdingMap[ticker] > 0)
        .map(ticker => ({ ticker, value: holdingMap[ticker] * (priceMap[ticker] || 0) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)

      const aiData = {
          totalValue: valTotal,
          totalProfit: totalPnL,
          xirr: xirrTotal.toFixed(2),
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
      
      {/* XIRR GRID */}
      <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2 opacity-80">
                <span className="font-medium">Total Portfolio XIRR</span>
                <TrendingUp className="h-5 w-5" />
            </div>
            <div className="text-4xl font-bold">{metrics.totalXirr.toFixed(2)}%</div>
            <p className="text-xs mt-2 opacity-70">Annualized Return</p>
          </div>

          <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2 text-slate-500 dark:text-slate-400">
                <span className="font-medium">Equity XIRR</span>
                <BarChart3 className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{metrics.equityXirr.toFixed(2)}%</div>
            <p className="text-xs mt-2 text-slate-400">Stocks & Mutual Funds</p>
          </div>

          <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2 text-slate-500 dark:text-slate-400">
                <span className="font-medium">Commodity XIRR</span>
                <Gem className="h-5 w-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{metrics.commXirr.toFixed(2)}%</div>
            <p className="text-xs mt-2 text-slate-400">Gold, Silver & Currency</p>
          </div>
      </div>

      {aiSummary && <AIAnalyst data={aiSummary} />}

      {/* BREAKDOWN */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Worth</h4>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">₹{metrics.currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Unrealized P&L</h4>
            <div className={`mt-2 text-2xl font-bold ${metrics.unrealized >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {metrics.unrealized >= 0 ? '+' : ''}₹{metrics.unrealized.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Realized P&L (Booked + Div)</h4>
            <div className={`mt-2 text-2xl font-bold ${metrics.realized >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {metrics.realized >= 0 ? '+' : ''}₹{metrics.realized.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid gap-6 md:grid-cols-2">
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