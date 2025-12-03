'use client'

import { useEffect, useState, useMemo } from 'react'
import { calculateXIRR } from '@/lib/xirr'
import { Loader2, TrendingUp, BarChart3, Gem, Building2, Briefcase, PieChart as PieIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import { usePortfolio } from '@/context/portfolio-context'
import AIAnalyst from '@/components/ai-analyst'
import PortfolioHistoryChart from '@/components/portfolio-history-chart'
import { useTransactions, useLivePrices } from '@/hooks/use-portfolio-data'

// Professional Color Palette
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#64748b']

type ChartDataPoint = { date: string; invested: number; value: number }

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio()
  
  // 1. DATA HOOKS
  const { data: transactions, isLoading: txnsLoading } = useTransactions()
  
  const allTickers = useMemo(() => {
      if (!transactions) return []
      return Array.from(new Set(transactions.map(t => t.assets.ticker)))
  }, [transactions])

  const { data: priceMap, isLoading: pricesLoading } = useLivePrices(allTickers)

  // Chart State
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartCategory, setChartCategory] = useState<'equity' | 'commodity'>('equity')
  const [currentRange, setCurrentRange] = useState('1y')

  const getCategory = (type: string) => {
      const t = type.toLowerCase()
      if (t.includes('commodity') || t.includes('gold') || t.includes('silver') || t.includes('currency')) return 'commodity'
      return 'equity'
  }

  // 3. CALCULATION ENGINE (Corrected P&L Logic)
  const { metrics, sectorData, conglomerateData, aiSummary } = useMemo(() => {
      const emptyMetrics = { totalXirr: 0, equityXirr: 0, commXirr: 0, netWorth: 0, unrealized: 0, realized: 0, totalProfit: 0, investment: 0, currentVal: 0, xirr: 0 }
      
      if (!transactions || !priceMap) return { metrics: emptyMetrics, sectorData: [], conglomerateData: [], aiSummary: null }

      // A. Metrics for XIRR (Flows)
      const flowsTotal: any[] = []; const flowsEquity: any[] = []; const flowsComm: any[] = []
      let totalDividends = 0
      
      // B. Metrics for P&L (FIFO Lots)
      const assetLots: Record<string, { price: number, quantity: number }[]> = {}
      const portfolio: Record<string, any> = {} // To track Cost Basis
      let totalRealizedPnL = 0

      // Process Transactions
      transactions.forEach((t) => {
        const { ticker, name, asset_type, sector } = t.assets
        const category = getCategory(asset_type)
        
        // 1. XIRR Flows
        const flowDate = new Date(t.date)
        const totalVal = Math.abs(Number(t.price) * Number(t.quantity))
        let flowAmount = 0

        if (t.transaction_type === 'Buy') {
            flowAmount = -totalVal
        } else if (t.transaction_type === 'Sell') {
            flowAmount = totalVal
        } else if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
            flowAmount = Math.abs(Number(t.total_value))
            totalDividends += flowAmount
        }
        
        const flow = { amount: flowAmount, date: flowDate }
        flowsTotal.push(flow)
        if (category === 'commodity') flowsComm.push(flow)
        else flowsEquity.push(flow)

        // 2. P&L Logic (FIFO)
        if (t.realised_pnl) totalRealizedPnL += Number(t.realised_pnl)

        if (!assetLots[ticker]) {
            assetLots[ticker] = []
            portfolio[ticker] = { quantity: 0, totalInvested: 0, ticker, name, type: asset_type, sector }
        }

        if (t.transaction_type === 'Buy') {
            assetLots[ticker].push({ price: Number(t.price), quantity: Number(t.quantity) })
        } else if (t.transaction_type === 'Sell') {
            let qtyToSell = Number(t.quantity)
            while (qtyToSell > 0 && assetLots[ticker].length > 0) {
                if (assetLots[ticker][0].quantity > qtyToSell) {
                    assetLots[ticker][0].quantity -= qtyToSell; qtyToSell = 0
                } else {
                    qtyToSell -= assetLots[ticker][0].quantity; assetLots[ticker].shift()
                }
            }
        }
      })

      // C. Calculate Current State (Valuation & Cost Basis)
      let valTotal = 0, valEq = 0, valComm = 0
      let costTotal = 0 // Cost basis of currently held assets

      const sectorMap: Record<string, number> = {}
      const groupMap: Record<string, number> = {} 

      // Summarize Lots
      Object.keys(assetLots).forEach(ticker => {
          let q = 0, c = 0
          assetLots[ticker].forEach(lot => { q += lot.quantity; c += (lot.quantity * lot.price) })
          portfolio[ticker].quantity = q
          portfolio[ticker].totalInvested = c
          
          if (q > 0) {
              const cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
              let price = priceMap[ticker]?.price
              if (!price) {
                  const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
                  if (foundKey) price = priceMap[foundKey]?.price
              }
              price = price || 0

              const val = q * price
              valTotal += val
              costTotal += c

              const cat = getCategory(portfolio[ticker].type)
              if (cat === 'commodity') valComm += val; else valEq += val

              // Sector & Group Logic
              let sec = portfolio[ticker].sector
              if (!sec || sec === 'Unknown') {
                  if (cat === 'commodity') sec = 'Commodities'
                  else sec = 'Unclassified'
              }
              sectorMap[sec] = (sectorMap[sec] || 0) + val

              const nameUpper = portfolio[ticker].name.toUpperCase()
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
              
              if (group !== 'Others') groupMap[group] = (groupMap[group] || 0) + val
          }
      })

      // D. Final Metrics
      // Unrealized = Current Value - Cost Basis of Current Holdings
      const unrealized = valTotal - costTotal 
      
      // Total Profit = Unrealized + Realized + Dividends
      const totalProfit = unrealized + totalRealizedPnL + totalDividends

      const xirrTotal = (flowsTotal.length > 0 || valTotal > 0) ? calculateXIRR(flowsTotal, valTotal) : 0
      const xirrEq = (flowsEquity.length > 0 || valEq > 0) ? calculateXIRR(flowsEquity, valEq) : 0
      const xirrComm = (flowsComm.length > 0 || valComm > 0) ? calculateXIRR(flowsComm, valComm) : 0

      const finalMetrics = {
        totalXirr: xirrTotal, equityXirr: xirrEq, commXirr: xirrComm,
        netWorth: valTotal, unrealized: unrealized, realized: totalRealizedPnL + totalDividends,
        totalProfit: totalProfit, investment: costTotal, currentVal: valTotal, xirr: xirrTotal 
      }

      // Format Charts
      const formattedSectors = Object.keys(sectorMap).map(k => ({ name: k, value: sectorMap[k] })).sort((a, b) => b.value - a.value)
      const formattedGroups = Object.keys(groupMap).map(k => ({ name: k, value: groupMap[k] })).sort((a, b) => b.value - a.value)

      const topHoldings = Object.values(portfolio).filter((h:any) => h.quantity > 0)
          .map((h:any) => ({ ticker: h.ticker, value: h.quantity * (priceMap[h.ticker]?.price || 0) }))
          .sort((a, b) => b.value - a.value).slice(0, 5)

      const summary = { 
          totalValue: valTotal, totalProfit: totalProfit, xirr: xirrTotal.toFixed(2), 
          sectors: formattedSectors, holdings: topHoldings 
      }

      return { metrics: finalMetrics, sectorData: formattedSectors, conglomerateData: formattedGroups, aiSummary: summary }

  }, [transactions, priceMap])


  // --- CHART FETCHING ---
  useEffect(() => {
      if (transactions && transactions.length > 0) fetchChartData('1y', 'equity')
  }, [transactions]) 

  const fetchChartData = async (range: string, category: 'equity' | 'commodity') => {
      if (!transactions) return
      setChartLoading(true); setChartCategory(category); setCurrentRange(range)
      try {
        const relevantTickers = new Set<string>()
        const categoryTxns = transactions.filter(t => {
            const cat = getCategory(t.assets.asset_type)
            if (cat === category) { relevantTickers.add(t.assets.ticker); return true }
            return false
        })

        if (relevantTickers.size === 0) { setChartData([]); setChartLoading(false); return }

        const res = await fetch('/api/history', { method: 'POST', body: JSON.stringify({ tickers: Array.from(relevantTickers), range }) })
        const historyMap = await res.json()
        
        const priceLookup: Record<string, Record<string, number>> = {}
        const allDatesSet = new Set<string>()
        Object.entries(historyMap).forEach(([ticker, history]: [string, any]) => {
            if (!Array.isArray(history)) return
            history.forEach((point: any) => { const d = point.date; allDatesSet.add(d); if (!priceLookup[d]) priceLookup[d] = {}; priceLookup[d][ticker] = point.price })
        })
        const sortedDates = Array.from(allDatesSet).sort()
        const finalChartData: ChartDataPoint[] = []
        const runningHoldings: Record<string, number> = {}
        let runningInvested = 0; let txnIndex = 0

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
            let dailyValue = 0; const daysPrices = priceLookup[date] || {}
            Object.keys(runningHoldings).forEach(ticker => {
                const qty = runningHoldings[ticker]
                if (qty > 0) { const price = daysPrices[ticker] || 0; if (price > 0) dailyValue += (qty * price) }
            })
            if (runningInvested > 0 || dailyValue > 0) finalChartData.push({ date, invested: Math.max(0, runningInvested), value: dailyValue })
        }
        setChartData(finalChartData)
      } catch (e) { console.error(e) } finally { setChartLoading(false) }
  }

  if (txnsLoading && !metrics) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-6 pb-10">
      
      <PortfolioHistoryChart 
         data={chartData} isLoading={chartLoading} category={chartCategory}
         onRangeChange={(r) => fetchChartData(r, chartCategory)} 
         onCategoryChange={(c) => fetchChartData(currentRange, c)}
      />

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

      {aiSummary && <AIAnalyst data={aiSummary} />}

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

      {/* RISK ANALYSIS */}
      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Risk Analysis</h3>
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* 1. SECTOR (Donut) */}
        <div className="h-96 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            <h3 className="mb-4 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-indigo-500" /> Sector Allocation
            </h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            data={sectorData} 
                            cx="50%" cy="50%" 
                            innerRadius={60} 
                            outerRadius={100} 
                            paddingAngle={2} 
                            dataKey="value"
                        >
                            {sectorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(val: number) => [`₹${val.toLocaleString('en-IN', {maximumFractionDigits: 0})}`, 'Value']}
                        />
                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', lineHeight: '18px'}} iconSize={8} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* 2. CONGLOMERATE (Enhanced Bar) */}
        <div className="h-96 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            <h3 className="mb-4 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-amber-500" /> Conglomerate Radar
            </h3>
            <div className="flex-1 min-h-0">
                {conglomerateData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conglomerateData} layout="vertical" margin={{ left: 0, right: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={100} 
                                tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}} 
                                axisLine={false} 
                                tickLine={false}
                            />
                            <Tooltip 
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Exposure']}
                            />
                            <Bar dataKey="value" fill="url(#colorGradient)" radius={[0, 6, 6, 0]} barSize={24}>
                                {conglomerateData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400 text-sm bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Briefcase className="h-8 w-8 mb-2 opacity-20" />
                        No major conglomerate exposure found.
                    </div>
                )}
            </div>
        </div>

      </div>

      {/* Portfolio Health (Kept as is) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 mt-6">
         {/* ... (Health content unchanged) ... */}
      </div>
    </div>
  )
}

function PieChartIcon({className}: {className?: string}) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
    )
}