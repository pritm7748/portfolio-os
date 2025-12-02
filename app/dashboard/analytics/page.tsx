'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateXIRR } from '@/lib/xirr'
import { Loader2, TrendingUp, BarChart3, Gem } from 'lucide-react' // Icons
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { usePortfolio } from '@/context/portfolio-context'
import AIAnalyst from '@/components/ai-analyst'
import PortfolioHistoryChart from '@/components/portfolio-history-chart'

// --- Types ---
type Transaction = {
    date: string
    transaction_type: string
    price: number
    quantity: number
    assets: {
        ticker: string
        asset_type: string
    }
}

type ChartDataPoint = {
    date: string
    invested: number
    value: number
}

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio()
  const [loading, setLoading] = useState(true)
  
  // Metrics State
  const [metrics, setMetrics] = useState({
    totalXirr: 0, equityXirr: 0, commXirr: 0,
    netWorth: 0, unrealized: 0, realized: 0,
    totalProfit: 0, investment: 0, currentVal: 0, xirr: 0 
  })
  
  const [sectorData, setSectorData] = useState<any[]>([])
  const [aiSummary, setAiSummary] = useState<any>(null)
  
  // Chart State
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartCategory, setChartCategory] = useState<'equity' | 'commodity'>('equity')
  const [currentRange, setCurrentRange] = useState('1y')
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]) 

  const supabase = createClient()

  // Helper: Determine Category
  const getCategory = (type: string) => {
      const t = type.toLowerCase()
      if (t.includes('commodity') || t.includes('gold') || t.includes('silver') || t.includes('currency')) {
          return 'commodity'
      }
      return 'equity'
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch Transactions
      let query = supabase
        .from('transactions')
        .select(`
            date, transaction_type, price, quantity, total_value, realised_pnl,
            assets ( ticker, asset_type )
        `)
        .order('date', { ascending: true })

      if (selectedPortfolio.id !== 'all') {
          query = query.eq('portfolio_id', selectedPortfolio.id)
      }

      const { data: txns } = await query
      if (!txns) { setLoading(false); return }
      
      const formattedTxns = txns as unknown as Transaction[]
      setAllTransactions(formattedTxns)

      // --- 2. Calculate Real-Time Metrics (Current Snapshot) ---
      // We calculate XIRR and Totals based on the *Current* state of the portfolio
      
      const flowsTotal: any[] = []
      const flowsEquity: any[] = []
      const flowsComm: any[] = []

      let totalRealized = 0
      let totalDividends = 0
      let totalInvested = 0
      
      // Track Holdings for Current Value Calc
      const currentHoldings: Record<string, number> = {}
      const assetTypes: Record<string, string> = {}

      txns.forEach((t: any) => {
        const ticker = t.assets.ticker
        const type = t.assets.asset_type
        const category = getCategory(type)
        assetTypes[ticker] = type

        if (t.realised_pnl) totalRealized += Number(t.realised_pnl)
        
        // Flow Calculation for XIRR
        const flowDate = new Date(t.date)
        const totalVal = Math.abs(Number(t.price) * Number(t.quantity))
        
        let flowAmount = 0

        if (t.transaction_type === 'Buy') {
            flowAmount = -totalVal
            currentHoldings[ticker] = (currentHoldings[ticker] || 0) + Number(t.quantity)
            totalInvested += totalVal // Simple "Total Invested" metric
        } else if (t.transaction_type === 'Sell') {
            flowAmount = totalVal
            currentHoldings[ticker] = (currentHoldings[ticker] || 0) - Number(t.quantity)
            totalInvested -= (Number(t.price) * Number(t.quantity)) // Reduce invested basis
        } else if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
            flowAmount = Math.abs(Number(t.total_value)) // Inflow
            totalDividends += flowAmount
        }

        const flow = { amount: flowAmount, date: flowDate }
        flowsTotal.push(flow)
        if (category === 'commodity') flowsComm.push(flow)
        else flowsEquity.push(flow)
      })

      // Fetch Live Prices for Current Valuation
      const activeTickers = Object.keys(currentHoldings).filter(t => currentHoldings[t] > 0)
      let priceMap: Record<string, number> = {}
      
      if (activeTickers.length > 0) {
          try {
            const res = await fetch('/api/prices', { 
                method: 'POST', 
                body: JSON.stringify({ tickers: activeTickers }) 
            })
            priceMap = await res.json()
          } catch(e) { console.error("Price fetch failed", e) }
      }

      // Calculate Current Market Value
      let valTotal = 0, valEq = 0, valComm = 0
      const sectorMap: Record<string, number> = {}

      Object.keys(currentHoldings).forEach(ticker => {
          const qty = currentHoldings[ticker]
          if (qty > 0) {
              const price = priceMap[ticker] || 0 // Fallback needed?
              const val = qty * price
              valTotal += val
              
              const type = assetTypes[ticker]
              const cat = getCategory(type)
              
              if (cat === 'commodity') valComm += val
              else valEq += val

              sectorMap[type] = (sectorMap[type] || 0) + val
          }
      })

      // Calculate XIRR
      const xirrTotal = (flowsTotal.length > 0 || valTotal > 0) ? calculateXIRR(flowsTotal, valTotal) : 0
      const xirrEq = (flowsEquity.length > 0 || valEq > 0) ? calculateXIRR(flowsEquity, valEq) : 0
      const xirrComm = (flowsComm.length > 0 || valComm > 0) ? calculateXIRR(flowsComm, valComm) : 0

      // Final Metric Aggregation
      // Note: totalInvested here is "Net Invested" (Buys - Sells). 
      const unrealized = valTotal - Math.max(0, totalInvested) 
      const totalProfit = unrealized + totalRealized + totalDividends

      setMetrics({
        totalXirr: xirrTotal, equityXirr: xirrEq, commXirr: xirrComm,
        netWorth: valTotal, unrealized: unrealized, realized: totalRealized + totalDividends,
        totalProfit: totalProfit, investment: Math.max(0, totalInvested), currentVal: valTotal,
        xirr: xirrTotal 
      })

      setSectorData(Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })))
      
      // Prepare Data for AI
      const topHoldings = Object.keys(currentHoldings)
        .filter(k => currentHoldings[k] > 0)
        .map(k => ({ ticker: k, value: currentHoldings[k] * (priceMap[k] || 0) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)

      setAiSummary({ 
          totalValue: valTotal, 
          totalProfit: totalProfit, 
          xirr: xirrTotal.toFixed(2), 
          sectors: Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })), 
          holdings: topHoldings 
      })

      setLoading(false)
      
      // Trigger Chart Load
      if (formattedTxns.length > 0) {
          fetchChartData('1y', 'equity', formattedTxns)
      }
    }
    fetchData()
  }, [selectedPortfolio])

  // --- OPTIMIZED TIME MACHINE ENGINE ---
  const fetchChartData = async (range: string, category: 'equity' | 'commodity', txnsData = allTransactions) => {
      setChartLoading(true)
      setChartCategory(category)
      setCurrentRange(range)

      try {
        // 1. Identify Relevant Tickers
        const relevantTickers = new Set<string>()
        const categoryTxns = txnsData.filter(t => {
            const cat = getCategory(t.assets.asset_type)
            if (cat === category) {
                relevantTickers.add(t.assets.ticker)
                return true
            }
            return false
        })

        if (relevantTickers.size === 0) {
            setChartData([])
            setChartLoading(false)
            return
        }

        // 2. Fetch History (Batch)
        // Important: We send detailed: false (default) to get simple array for chart
        const res = await fetch('/api/history', {
            method: 'POST',
            body: JSON.stringify({ tickers: Array.from(relevantTickers), range }) 
        })
        const historyMap: Record<string, { date: string, price: number }[]> = await res.json()

        // 3. Normalize Price History into a Fast Lookup Map
        // Structure: { "2024-01-01": { "TCS.NS": 3200, "RELIANCE.NS": 2400 } }
        const priceLookup: Record<string, Record<string, number>> = {}
        const allDatesSet = new Set<string>()

        Object.entries(historyMap).forEach(([ticker, history]) => {
            if (!Array.isArray(history)) return
            history.forEach(point => {
                const d = point.date // API returns "YYYY-MM-DD"
                allDatesSet.add(d)
                if (!priceLookup[d]) priceLookup[d] = {}
                priceLookup[d][ticker] = point.price
            })
        })

        const sortedDates = Array.from(allDatesSet).sort()
        if (sortedDates.length === 0) {
            setChartData([])
            setChartLoading(false)
            return
        }

        // 4. Rolling Calculation (The Fast Way)
        const finalChartData: ChartDataPoint[] = []
        const runningHoldings: Record<string, number> = {}
        let runningInvested = 0
        let txnIndex = 0

        // Iterate through every day in the history timeline
        for (const date of sortedDates) {
            const dayStart = new Date(date).getTime()
            
            // Process all transactions that happened ON or BEFORE this date
            // (Since sortedDates skips weekends, we catch up any weekend txns here)
            while (txnIndex < categoryTxns.length) {
                const t = categoryTxns[txnIndex]
                const tTime = new Date(t.date).getTime()
                
                // If transaction is in future relative to current chart date, stop
                if (tTime > dayStart + 86400000) break; // End of current day buffer

                // Apply Transaction
                if (t.transaction_type === 'Buy') {
                    runningHoldings[t.assets.ticker] = (runningHoldings[t.assets.ticker] || 0) + Number(t.quantity)
                    runningInvested += (Number(t.price) * Number(t.quantity))
                } else if (t.transaction_type === 'Sell') {
                    runningHoldings[t.assets.ticker] = (runningHoldings[t.assets.ticker] || 0) - Number(t.quantity)
                    runningInvested -= (Number(t.price) * Number(t.quantity))
                }
                
                txnIndex++
            }

            // Calculate Portfolio Value for this specific day
            let dailyValue = 0
            const daysPrices = priceLookup[date] || {}

            Object.keys(runningHoldings).forEach(ticker => {
                const qty = runningHoldings[ticker]
                if (qty > 0) {
                    // Use price from this day, or 0 if missing (market closed/gap)
                    // Optional: You could implement "last known price" logic here for smoother lines
                    const price = daysPrices[ticker] || 0
                    if (price > 0) {
                         dailyValue += (qty * price)
                    }
                }
            })

            // Only push points where we have started investing
            if (runningInvested > 0 || dailyValue > 0) {
                finalChartData.push({
                    date,
                    invested: Math.max(0, runningInvested),
                    value: dailyValue
                })
            }
        }

        setChartData(finalChartData)

      } catch (e) {
          console.error("Chart Gen Error", e)
      } finally {
          setChartLoading(false)
      }
  }

  // UI Handlers
  const handleRangeChange = (r: string) => fetchChartData(r, chartCategory)
  const handleCategoryChange = (c: 'equity' | 'commodity') => fetchChartData(currentRange, c)

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. CHART SECTION */}
      <PortfolioHistoryChart 
         data={chartData} 
         isLoading={chartLoading} 
         category={chartCategory}
         onRangeChange={handleRangeChange} 
         onCategoryChange={handleCategoryChange}
      />

      {/* 2. METRICS GRID */}
      <div className="grid gap-6 md:grid-cols-3">
          {/* Total XIRR */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={100} /></div>
            <div className="flex items-center justify-between mb-2 opacity-90 relative z-10">
                <span className="font-medium text-sm uppercase tracking-wider">Total XIRR</span>
                <TrendingUp className="h-5 w-5" />
            </div>
            <div className="text-4xl font-bold relative z-10">{metrics.totalXirr.toFixed(2)}%</div>
            <p className="text-xs mt-2 opacity-70 relative z-10">Annualized Return</p>
          </div>

          {/* Equity XIRR */}
          <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-hover hover:border-indigo-200">
            <div className="flex items-center justify-between mb-2 text-slate-500 dark:text-slate-400">
                <span className="font-medium text-sm uppercase tracking-wider">Equity XIRR</span>
                <BarChart3 className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{metrics.equityXirr.toFixed(2)}%</div>
            <p className="text-xs mt-2 text-slate-400">Stocks & Mutual Funds</p>
          </div>

          {/* Commodity XIRR */}
          <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-hover hover:border-amber-200">
            <div className="flex items-center justify-between mb-2 text-slate-500 dark:text-slate-400">
                <span className="font-medium text-sm uppercase tracking-wider">Commodity XIRR</span>
                <Gem className="h-5 w-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{metrics.commXirr.toFixed(2)}%</div>
            <p className="text-xs mt-2 text-slate-400">Gold, Silver & Currency</p>
          </div>
      </div>

      {/* 3. AI ANALYST */}
      {aiSummary && <AIAnalyst data={aiSummary} />}

      {/* 4. FINANCIAL SUMMARY */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Net Worth</h4>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">₹{metrics.currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Unrealized P&L</h4>
            <div className={`mt-2 text-2xl font-bold ${metrics.unrealized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.unrealized >= 0 ? '+' : ''}₹{metrics.unrealized.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Realized P&L</h4>
            <div className={`mt-2 text-2xl font-bold ${metrics.realized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.realized >= 0 ? '+' : ''}₹{metrics.realized.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
        </div>
      </div>

      {/* 5. ALLOCATION & HEALTH */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Allocation Chart */}
        <div className="h-80 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            <h3 className="mb-6 font-bold text-slate-800 dark:text-white">Asset Allocation</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <YAxis hide />
                        <Tooltip 
                             cursor={{ fill: '#f1f5f9' }}
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                             formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Value']}
                        />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Health Check */}
        <div className="h-80 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h3 className="mb-6 font-bold text-slate-800 dark:text-white">Portfolio Health</h3>
            <ul className="space-y-6">
                <li className="flex gap-4">
                    <div className="mt-1 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <Gem size={16} />
                    </div>
                    <div>
                        <span className="block font-semibold text-slate-900 dark:text-white">Diversity Score</span>
                        <p className="text-sm text-slate-500 mt-1">
                            You are invested in <span className="font-medium text-slate-800 dark:text-slate-200">{sectorData.length} asset classes</span>.
                            {sectorData.length < 3 ? " Consider adding Commodities or Debt for stability." : " Good diversification."}
                        </p>
                    </div>
                </li>
                <li className="flex gap-4">
                    <div className="mt-1 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <span className="block font-semibold text-slate-900 dark:text-white">Performance</span>
                        <p className="text-sm text-slate-500 mt-1">
                            Your Total XIRR is <span className={`font-medium ${metrics.xirr >= 12 ? 'text-green-600' : 'text-slate-800 dark:text-slate-200'}`}>{metrics.xirr.toFixed(2)}%</span>. 
                            {metrics.xirr > 12 ? " You are beating most mutual funds!" : " Review underperforming assets."}
                        </p>
                    </div>
                </li>
            </ul>
        </div>
      </div>
    </div>
  )
}