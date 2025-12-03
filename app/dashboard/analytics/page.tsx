'use client'

import { useEffect, useState, useMemo } from 'react'
import { calculateXIRR } from '@/lib/xirr'
import { Loader2, TrendingUp, BarChart3, Gem, Building2, Briefcase } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { usePortfolio } from '@/context/portfolio-context'
import AIAnalyst from '@/components/ai-analyst'
import PortfolioHistoryChart from '@/components/portfolio-history-chart'
import { useTransactions, useLivePrices } from '@/hooks/use-portfolio-data'

// Colors for Pie Chart
const COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#64748b']

type ChartDataPoint = {
    date: string
    invested: number
    value: number
}

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio()
  
  // 1. DATA HOOKS
  const { data: transactions, isLoading: txnsLoading } = useTransactions()
  
  // 2. Derive Tickers for Current Valuation
  const allTickers = useMemo(() => {
      if (!transactions) return []
      return Array.from(new Set(transactions.map(t => t.assets.ticker)))
  }, [transactions])

  const { data: priceMap, isLoading: pricesLoading } = useLivePrices(allTickers)

  // Chart specific state
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartCategory, setChartCategory] = useState<'equity' | 'commodity'>('equity')
  const [currentRange, setCurrentRange] = useState('1y')

  // Helper
  const getCategory = (type: string) => {
      const t = type.toLowerCase()
      if (t.includes('commodity') || t.includes('gold') || t.includes('silver') || t.includes('currency')) {
          return 'commodity'
      }
      return 'equity'
  }

  // 3. CALCULATION ENGINE (Memoized)
  const { metrics, sectorData, conglomerateData, aiSummary } = useMemo(() => {
      // Default / Empty State
      const emptyMetrics = { 
          totalXirr: 0, equityXirr: 0, commXirr: 0,
          netWorth: 0, unrealized: 0, realized: 0,
          totalProfit: 0, investment: 0, currentVal: 0, xirr: 0 
      }

      if (!transactions || !priceMap) return { metrics: emptyMetrics, sectorData: [], conglomerateData: [], aiSummary: null }

      const flowsTotal: any[] = []
      const flowsEquity: any[] = []
      const flowsComm: any[] = []

      let totalRealized = 0
      let totalDividends = 0
      let totalInvested = 0
      
      const currentHoldings: Record<string, number> = {}
      const assetMeta: Record<string, any> = {} // Store name, sector, type

      transactions.forEach((t) => {
        const { ticker, name, asset_type, sector } = t.assets
        const type = asset_type
        const category = getCategory(type)
        
        assetMeta[ticker] = { name, type, sector } // Store metadata for later grouping

        if (t.realised_pnl) totalRealized += Number(t.realised_pnl)
        
        const flowDate = new Date(t.date)
        const totalVal = Math.abs(Number(t.price) * Number(t.quantity))
        let flowAmount = 0

        if (t.transaction_type === 'Buy') {
            flowAmount = -totalVal
            currentHoldings[ticker] = (currentHoldings[ticker] || 0) + Number(t.quantity)
            totalInvested += totalVal
        } else if (t.transaction_type === 'Sell') {
            flowAmount = totalVal
            currentHoldings[ticker] = (currentHoldings[ticker] || 0) - Number(t.quantity)
            totalInvested -= (Number(t.price) * Number(t.quantity))
        } else if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
            flowAmount = Math.abs(Number(t.total_value))
            totalDividends += flowAmount
        }

        const flow = { amount: flowAmount, date: flowDate }
        flowsTotal.push(flow)
        if (category === 'commodity') flowsComm.push(flow)
        else flowsEquity.push(flow)
      })

      // Valuation & Grouping
      let valTotal = 0, valEq = 0, valComm = 0
      
      const sectorMap: Record<string, number> = {}
      const groupMap: Record<string, number> = {} // For Conglomerates

      Object.keys(currentHoldings).forEach(ticker => {
          const qty = currentHoldings[ticker]
          if (qty > 0) {
              // Fuzzy match for Yahoo Tickers
              const cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
              let price = priceMap[ticker]?.price
              if (!price) {
                  const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
                  if (foundKey) price = priceMap[foundKey]?.price
              }
              price = price || 0

              const val = qty * price
              valTotal += val
              
              const meta = assetMeta[ticker]
              const cat = getCategory(meta.type)
              
              if (cat === 'commodity') valComm += val
              else valEq += val

              // 1. Sector Logic (From DB or Default)
              // If sector is missing or 'Unknown', check asset type
              let sec = meta.sector
              if (!sec || sec === 'Unknown') {
                  if (cat === 'commodity') sec = 'Commodities'
                  else sec = 'Unclassified'
              }
              sectorMap[sec] = (sectorMap[sec] || 0) + val

              // 2. Conglomerate Logic (Regex on Name)
              const nameUpper = meta.name.toUpperCase()
              let group = 'Others'
              
              if (nameUpper.match(/TATA|TITAN|TCS|VOLTAS|TRENT|INDIAN HOTELS/)) group = 'Tata Group'
              else if (nameUpper.match(/ADANI|AMBUJA|ACC/)) group = 'Adani Group'
              else if (nameUpper.match(/RELIANCE|JIO|NETWORK18/)) group = 'Reliance Group'
              else if (nameUpper.match(/HDFC/)) group = 'HDFC Group'
              else if (nameUpper.match(/BAJAJ/)) group = 'Bajaj Group'
              else if (nameUpper.match(/MAHINDRA|M&M/)) group = 'Mahindra Group'
              else if (nameUpper.match(/L&T|LARSEN/)) group = 'L&T Group'
              else if (nameUpper.match(/GRASIM|HINDALCO|ULTRATECH|ADITYA BIRLA/)) group = 'Birla Group'
              else if (nameUpper.match(/GODREJ/)) group = 'Godrej Group'
              else if (nameUpper.match(/SBI|STATE BANK/)) group = 'SBI Group'
              else if (nameUpper.match(/ICICI/)) group = 'ICICI Group'
              
              // Only track specific groups, everything else is 'Others' (which we filter out from chart usually)
              if (group !== 'Others') {
                  groupMap[group] = (groupMap[group] || 0) + val
              }
          }
      })

      // XIRR
      const xirrTotal = (flowsTotal.length > 0 || valTotal > 0) ? calculateXIRR(flowsTotal, valTotal) : 0
      const xirrEq = (flowsEquity.length > 0 || valEq > 0) ? calculateXIRR(flowsEquity, valEq) : 0
      const xirrComm = (flowsComm.length > 0 || valComm > 0) ? calculateXIRR(flowsComm, valComm) : 0

      const unrealized = valTotal - Math.max(0, totalInvested) 
      const totalProfit = unrealized + totalRealized + totalDividends

      const finalMetrics = {
        totalXirr: xirrTotal, equityXirr: xirrEq, commXirr: xirrComm,
        netWorth: valTotal, unrealized: unrealized, realized: totalRealized + totalDividends,
        totalProfit: totalProfit, investment: Math.max(0, totalInvested), currentVal: valTotal,
        xirr: xirrTotal 
      }

      // Format Data for Charts
      const formattedSectors = Object.keys(sectorMap)
        .map(k => ({ name: k, value: sectorMap[k] }))
        .sort((a, b) => b.value - a.value)
      
      const formattedGroups = Object.keys(groupMap)
        .map(k => ({ name: k, value: groupMap[k] }))
        .sort((a, b) => b.value - a.value)

      // AI Data
      const topHoldings = Object.keys(currentHoldings)
        .filter(k => currentHoldings[k] > 0)
        .map(k => ({ ticker: k, value: currentHoldings[k] * (priceMap[k]?.price || 0) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)

      const summary = { 
          totalValue: valTotal, 
          totalProfit: totalProfit, 
          xirr: xirrTotal.toFixed(2), 
          sectors: formattedSectors, 
          holdings: topHoldings 
      }

      return { metrics: finalMetrics, sectorData: formattedSectors, conglomerateData: formattedGroups, aiSummary: summary }

  }, [transactions, priceMap])


  // --- CHART ENGINE (Triggered on Mount + Change) ---
  useEffect(() => {
      if (transactions && transactions.length > 0) {
          fetchChartData('1y', 'equity')
      }
  }, [transactions]) 

  const fetchChartData = async (range: string, category: 'equity' | 'commodity') => {
      if (!transactions) return
      setChartLoading(true)
      setChartCategory(category)
      setCurrentRange(range)

      try {
        const relevantTickers = new Set<string>()
        const categoryTxns = transactions.filter(t => {
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

        const res = await fetch('/api/history', {
            method: 'POST',
            body: JSON.stringify({ tickers: Array.from(relevantTickers), range }) 
        })
        const historyMap = await res.json()

        const priceLookup: Record<string, Record<string, number>> = {}
        const allDatesSet = new Set<string>()

        Object.entries(historyMap).forEach(([ticker, history]: [string, any]) => {
            if (!Array.isArray(history)) return
            history.forEach((point: any) => {
                const d = point.date
                allDatesSet.add(d)
                if (!priceLookup[d]) priceLookup[d] = {}
                priceLookup[d][ticker] = point.price
            })
        })

        const sortedDates = Array.from(allDatesSet).sort()
        const finalChartData: ChartDataPoint[] = []
        const runningHoldings: Record<string, number> = {}
        let runningInvested = 0
        let txnIndex = 0

        for (const date of sortedDates) {
            const dayStart = new Date(date).getTime()
            while (txnIndex < categoryTxns.length) {
                const t = categoryTxns[txnIndex]
                const tTime = new Date(t.date).getTime()
                if (tTime > dayStart + 86400000) break; 

                if (t.transaction_type === 'Buy') {
                    runningHoldings[t.assets.ticker] = (runningHoldings[t.assets.ticker] || 0) + Number(t.quantity)
                    runningInvested += (Number(t.price) * Number(t.quantity))
                } else if (t.transaction_type === 'Sell') {
                    runningHoldings[t.assets.ticker] = (runningHoldings[t.assets.ticker] || 0) - Number(t.quantity)
                    runningInvested -= (Number(t.price) * Number(t.quantity))
                }
                txnIndex++
            }

            let dailyValue = 0
            const daysPrices = priceLookup[date] || {}
            Object.keys(runningHoldings).forEach(ticker => {
                const qty = runningHoldings[ticker]
                if (qty > 0) {
                    const price = daysPrices[ticker] || 0
                    if (price > 0) dailyValue += (qty * price)
                }
            })

            if (runningInvested > 0 || dailyValue > 0) {
                finalChartData.push({ date, invested: Math.max(0, runningInvested), value: dailyValue })
            }
        }
        setChartData(finalChartData)

      } catch (e) { console.error(e) } 
      finally { setChartLoading(false) }
  }

  // Loading State
  if (txnsLoading && !metrics) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. CHART */}
      <PortfolioHistoryChart 
         data={chartData} 
         isLoading={chartLoading} 
         category={chartCategory}
         onRangeChange={(r) => fetchChartData(r, chartCategory)} 
         onCategoryChange={(c) => fetchChartData(currentRange, c)}
      />

      {/* 2. METRICS */}
      {metrics && (
        <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={100} /></div>
                <div className="flex items-center justify-between mb-2 opacity-90 relative z-10">
                    <span className="font-medium text-sm uppercase tracking-wider">Total XIRR</span>
                    <TrendingUp className="h-5 w-5" />
                </div>
                <div className="text-4xl font-bold relative z-10">{metrics.totalXirr.toFixed(2)}%</div>
                <p className="text-xs mt-2 opacity-70 relative z-10">Annualized Return</p>
            </div>

            <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-hover hover:border-indigo-200">
                <div className="flex items-center justify-between mb-2 text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-sm uppercase tracking-wider">Equity XIRR</span>
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{metrics.equityXirr.toFixed(2)}%</div>
                <p className="text-xs mt-2 text-slate-400">Stocks & Mutual Funds</p>
            </div>

            <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-hover hover:border-amber-200">
                <div className="flex items-center justify-between mb-2 text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-sm uppercase tracking-wider">Commodity XIRR</span>
                    <Gem className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{metrics.commXirr.toFixed(2)}%</div>
                <p className="text-xs mt-2 text-slate-400">Gold, Silver & Currency</p>
            </div>
        </div>
      )}

      {/* 3. AI */}
      {aiSummary && <AIAnalyst data={aiSummary} />}

      {/* 4. FINANCIAL SUMMARY */}
      {metrics && (
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
      )}

      {/* 5. RISK ANALYSIS (New Section) */}
      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Risk Analysis</h3>
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* SECTOR ALLOCATION */}
        <div className="h-96 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            <h3 className="mb-6 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" /> Sector Exposure
            </h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            data={sectorData} 
                            cx="50%" cy="50%" 
                            innerRadius={60} 
                            outerRadius={80} 
                            paddingAngle={5} 
                            dataKey="value"
                        >
                            {sectorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(val: number) => [`₹${val.toLocaleString('en-IN', {maximumFractionDigits: 0})}`, 'Value']} 
                        />
                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px'}}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CONGLOMERATE RADAR */}
        <div className="h-96 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            <h3 className="mb-6 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-amber-500" /> Conglomerate Radar
            </h3>
            <div className="flex-1 min-h-0">
                {conglomerateData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conglomerateData} layout="vertical" margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={100} 
                                tick={{fontSize: 11, fill: '#64748b'}} 
                                axisLine={false} 
                                tickLine={false}
                            />
                            <Tooltip 
                                cursor={{ fill: '#f1f5f9' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Exposure']}
                            />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                        No major conglomerate exposure detected.
                    </div>
                )}
            </div>
        </div>

      </div>

      {/* 6. HEALTH CHECK */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <h3 className="mb-6 font-bold text-slate-800 dark:text-white">Portfolio Health</h3>
            <ul className="space-y-6">
                <li className="flex gap-4">
                    <div className="mt-1 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <Gem size={16} />
                    </div>
                    <div>
                        <span className="block font-semibold text-slate-900 dark:text-white">Diversity Score</span>
                        <p className="text-sm text-slate-500 mt-1">
                            You are invested in <span className="font-medium text-slate-800 dark:text-slate-200">{sectorData.length} sectors</span>.
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
  )
}