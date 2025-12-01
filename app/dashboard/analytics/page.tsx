'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateXIRR } from '@/lib/xirr'
import { Loader2, TrendingUp, Info, Gem, BarChart3, Wallet } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { usePortfolio } from '@/context/portfolio-context'
import AIAnalyst from '@/components/ai-analyst'
import PortfolioHistoryChart from '@/components/portfolio-history-chart'

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<any>({})
  const [sectorData, setSectorData] = useState<any[]>([])
  const [aiSummary, setAiSummary] = useState<any>(null)
  
  // Chart State
  const [chartData, setChartData] = useState<any[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartCategory, setChartCategory] = useState<'equity' | 'commodity'>('equity') // <--- New Toggle State
  const [allTransactions, setAllTransactions] = useState<any[]>([]) 

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
      
      setAllTransactions(txns)

      // --- METRICS LOGIC (Kept same as before) ---
      const assetLots: Record<string, any[]> = {}
      const holdingMap: Record<string, number> = {} 
      const allTickers = new Set<string>()
      let totalRealized = 0
      let totalDividends = 0
      const flowsTotal: any[] = [], flowsEquity: any[] = [], flowsComm: any[] = []

      txns.forEach((t: any) => {
        const ticker = t.assets.ticker
        const type = t.assets.asset_type
        const isComm = type === 'Commodity' || type === 'Currency' || type === 'Gold'
        allTickers.add(ticker)

        if (t.realised_pnl) totalRealized += Number(t.realised_pnl)
        if (!assetLots[ticker]) assetLots[ticker] = []
        if (!holdingMap[ticker]) holdingMap[ticker] = 0

        const txnValue = Math.abs(Number(t.price) * Number(t.quantity))

        if (t.transaction_type === 'Buy') {
            assetLots[ticker].push({ price: Number(t.price), quantity: Number(t.quantity) })
            holdingMap[ticker] += Number(t.quantity)
            const flow = { amount: -txnValue, date: t.date }
            flowsTotal.push(flow)
            if (isComm) flowsComm.push(flow)
            else flowsEquity.push(flow)
        } else if (t.transaction_type === 'Sell') {
            let qty = Number(t.quantity)
            holdingMap[ticker] -= qty
            while (qty > 0 && assetLots[ticker].length > 0) {
                const oldest = assetLots[ticker][0]
                if (oldest.quantity > qty) { oldest.quantity -= qty; qty = 0 } 
                else { qty -= oldest.quantity; assetLots[ticker].shift() }
            }
            const flow = { amount: txnValue, date: t.date }
            flowsTotal.push(flow)
            if (isComm) flowsComm.push(flow)
            else flowsEquity.push(flow)
        } else if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
            const incomeAmt = Math.abs(Number(t.total_value))
            totalDividends += incomeAmt
            const flow = { amount: incomeAmt, date: t.date }
            flowsTotal.push(flow)
            if (isComm) flowsComm.push(flow)
            else flowsEquity.push(flow)
        }
      })
      
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

      // Auto-Calc Dividends
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
                  const flow = { amount: divAmount, date: div.date }
                  flowsTotal.push(flow)
                  flowsEquity.push(flow)
              }
          })
      })

      let valTotal = 0, valEq = 0, valComm = 0, fifoCostTotal = 0
      const sectorMap: Record<string, number> = {}

      Object.keys(assetLots).forEach(ticker => {
          let lotCost = 0, lotQty = 0
          assetLots[ticker].forEach(lot => { lotCost += (lot.quantity * lot.price); lotQty += lot.quantity })
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

      const xirrTotal = (flowsTotal.length > 0 || valTotal > 0) ? calculateXIRR(flowsTotal, valTotal) : 0
      const xirrEq = (flowsEquity.length > 0 || valEq > 0) ? calculateXIRR(flowsEquity, valEq) : 0
      const xirrComm = (flowsComm.length > 0 || valComm > 0) ? calculateXIRR(flowsComm, valComm) : 0

      setMetrics({
        totalXirr: xirrTotal, equityXirr: xirrEq, commXirr: xirrComm,
        netWorth: valTotal, unrealized: valTotal - fifoCostTotal, realized: totalRealized + totalDividends,
        totalProfit: (valTotal - fifoCostTotal) + (totalRealized + totalDividends),
        investment: fifoCostTotal, currentVal: valTotal
      })
      setSectorData(Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })))
      
      const topHoldings = Object.keys(holdingMap).filter(k => holdingMap[k] > 0).map(k => ({ ticker: k, value: holdingMap[k] * (priceMap[k] || 0) })).sort((a, b) => b.value - a.value).slice(0, 5)
      setAiSummary({ totalValue: valTotal, totalProfit: (valTotal - fifoCostTotal) + totalRealized + totalDividends, xirr: xirrTotal.toFixed(2), sectors: Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })), holdings: topHoldings })

      setLoading(false)
      
      // Initial Chart: Equity
      if (txns.length > 0) fetchChartData('1y', 'equity', txns)
    }
    fetchData()
  }, [selectedPortfolio])

  // --- TIME MACHINE ENGINE ---
  const fetchChartData = async (range: string, category: 'equity' | 'commodity', txnsData = allTransactions) => {
      if (!txnsData || txnsData.length === 0) return
      setChartLoading(true)
      setChartCategory(category) // Update state

      try {
        // Filter tickers relevant to the selected category
        const relevantTickers = new Set<string>()
        txnsData.forEach((t: any) => {
            const type = t.assets.asset_type
            const isComm = type === 'Commodity' || type === 'Currency' || type === 'Gold'
            if (category === 'equity' && !isComm) relevantTickers.add(t.assets.ticker)
            if (category === 'commodity' && isComm) relevantTickers.add(t.assets.ticker)
        })

        if (relevantTickers.size === 0) {
             setChartData([])
             setChartLoading(false)
             return
        }
        
        const res = await fetch('/api/history', {
            method: 'POST',
            body: JSON.stringify({ tickers: Array.from(relevantTickers), range })
        })
        const historyMap = await res.json()
        const firstKey = Object.keys(historyMap)[0]
        if (!firstKey) { setChartLoading(false); return }
        
        const timeline = historyMap[firstKey].map((h: any) => h.date)
        
        const chartPoints = timeline.map((date: string) => {
            const currentObjDate = new Date(date)
            let invested = 0
            let value = 0
            const holdings: Record<string, number> = {}
            
            // Replay History
            txnsData.forEach((t: any) => {
                const type = t.assets.asset_type
                const isComm = type === 'Commodity' || type === 'Currency' || type === 'Gold'
                
                // Strict Filtering: Only process transactions for the active category
                if ((category === 'equity' && isComm) || (category === 'commodity' && !isComm)) return

                const tDate = new Date(t.date)
                if (tDate <= currentObjDate) {
                    if (t.transaction_type === 'Buy') {
                        holdings[t.assets.ticker] = (holdings[t.assets.ticker] || 0) + Number(t.quantity)
                        invested += (Number(t.price) * Number(t.quantity))
                    } else if (t.transaction_type === 'Sell') {
                        holdings[t.assets.ticker] = (holdings[t.assets.ticker] || 0) - Number(t.quantity)
                        invested -= (Number(t.price) * Number(t.quantity))
                    }
                }
            })

            Object.keys(holdings).forEach(ticker => {
                const qty = holdings[ticker]
                if (qty > 0) {
                    const priceHistory = historyMap[ticker]
                    const priceObj = priceHistory?.find((p: any) => p.date === date)
                    const price = priceObj ? priceObj.price : 0
                    value += (qty * price)
                }
            })

            return { date, invested: Math.max(0, invested), value }
        })

        setChartData(chartPoints)
      } catch (e) { console.error("Chart Error", e) } 
      finally { setChartLoading(false) }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-8">
      
      {/* CHART HEADER */}
      <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Performance Analytics</h2>
            
            {/* TOGGLE SWITCH */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button 
                    onClick={() => fetchChartData('1y', 'equity')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${chartCategory === 'equity' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                >
                    Equity
                </button>
                <button 
                    onClick={() => fetchChartData('1y', 'commodity')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${chartCategory === 'commodity' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-white' : 'text-slate-500'}`}
                >
                    Commodity
                </button>
            </div>
          </div>
          
          <p className="text-slate-500 dark:text-slate-400">Deep dive into your portfolio metrics and history.</p>
      </div>

      {/* 1. TIME MACHINE CHART */}
      <PortfolioHistoryChart 
         data={chartData} 
         isLoading={chartLoading} 
         category={chartCategory}
         onRangeChange={(r) => fetchChartData(r, chartCategory)} 
      />

      {/* 2. XIRR GRID */}
      <div className="grid gap-6 md:grid-cols-3">
          {/* ... (Same XIRR Cards) ... */}
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

      {/* 3. AI ANALYST */}
      {aiSummary && <AIAnalyst data={aiSummary} />}

      {/* 4. BREAKDOWN */}
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

      {/* 5. CHARTS */}
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