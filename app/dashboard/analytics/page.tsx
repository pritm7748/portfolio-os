'use client'

import { useEffect, useState, useMemo } from 'react'
import { calculateXIRR } from '@/lib/xirr'
import { Loader2, TrendingUp, BarChart3, Gem, Building2, Briefcase, Info } from 'lucide-react'
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend, Sector
} from 'recharts'
import { usePortfolio } from '@/context/portfolio-context'
import AIAnalyst from '@/components/ai-analyst'
import PortfolioHistoryChart from '@/components/portfolio-history-chart'
import { useTransactions, useLivePrices, useDividends } from '@/hooks/use-portfolio-data'
import { usePortfolioHistory } from '@/hooks/use-portfolio-history' // <--- 1. Import New Hook

// --- CONFIGURATION ---
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#64748b']

// --- HELPER: CUSTOM TOOLTIP ---
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        return (
            <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-sm min-w-[180px] z-[100] relative">
                <p className="font-bold text-slate-800 dark:text-white mb-1">{data.name}</p>
                <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Value:</span>
                    <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                        ₹{data.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                </div>
                {payload[0].percent !== undefined && (
                    <div className="flex items-center justify-between gap-4 text-xs mt-1">
                        <span className="text-slate-500 dark:text-slate-400">Allocation:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                            {(payload[0].percent * 100).toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>
        )
    }
    return null
}

// --- HELPER: STATIC ACTIVE SHAPE ---
const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    return (
        <Sector
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={startAngle}
            endAngle={endAngle}
            fill={fill}
            style={{ outline: 'none' }}
        />
    )
}

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio()
  const { data: transactions, isLoading: txnsLoading } = useTransactions()
  
  const allTickers = useMemo(() => {
      if (!transactions) return []
      return Array.from(new Set(transactions.map(t => t.assets.ticker)))
  }, [transactions])

  const { data: priceMap, isLoading: pricesLoading } = useLivePrices(allTickers)
  const { data: dividendMap, isLoading: divLoading } = useDividends(allTickers) // Added back dividendMap usage

  const [chartCategory, setChartCategory] = useState<'equity' | 'commodity'>('equity')
  
  // --- 2. GENERATE HISTORY (Client-Side FIFO) ---
  const { equity: equityHistory, commodity: commHistory } = usePortfolioHistory(transactions || [])

  const getCategory = (type: string) => {
      const t = type.toLowerCase()
      if (t.includes('commodity') || t.includes('gold') || t.includes('silver') || t.includes('currency')) return 'commodity'
      return 'equity'
  }

  // --- CALCULATION ENGINE ---
  const { metrics, sectorData, conglomerateData, aiSummary, statsDetails } = useMemo(() => {
      const emptyMetrics = { totalXirr: 0, equityXirr: 0, commXirr: 0, netWorth: 0, unrealized: 0, realized: 0, totalProfit: 0, investment: 0, currentVal: 0, xirr: 0 }
      const emptyStats = { invested: 0, current: 0, unrealizedPnl: 0, pnlPercent: 0, dayPnl: 0 }
      
      if (!transactions || !priceMap || !dividendMap) return { metrics: emptyMetrics, sectorData: [], conglomerateData: [], aiSummary: null, statsDetails: { equity: emptyStats, commodity: emptyStats } }

      const flowsTotal: any[] = []; const flowsEquity: any[] = []; const flowsComm: any[] = []
      let totalRealizedPnL = 0; let totalDividends = 0
      const assetLots: Record<string, { price: number, quantity: number }[]> = {}
      const portfolio: Record<string, any> = {} 

      transactions.forEach((t) => {
        const { ticker, name, asset_type, sector } = t.assets
        const category = getCategory(asset_type)
        if (t.realised_pnl) totalRealizedPnL += Number(t.realised_pnl)
        
        const flowDate = new Date(t.date)
        const totalVal = Math.abs(Number(t.price) * Number(t.quantity))
        let flowAmount = 0

        if (t.transaction_type === 'Buy') flowAmount = -totalVal
        else if (t.transaction_type === 'Sell') flowAmount = totalVal
        else if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
            flowAmount = Math.abs(Number(t.total_value))
            totalDividends += flowAmount
        }
        
        const flow = { amount: flowAmount, date: flowDate }
        flowsTotal.push(flow)
        if (category === 'commodity') flowsComm.push(flow)
        else flowsEquity.push(flow)

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

      let valTotal = 0; let valEq = 0; let valComm = 0; let costTotal = 0
      const sectorMap: Record<string, number> = {}
      const groupMap: Record<string, number> = {}

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

              let sec = portfolio[ticker].sector
              const assetType = portfolio[ticker].type?.toLowerCase() || ''

              if (!sec || sec === 'Unknown' || sec === 'Unclassified') {
                  if (cat === 'commodity') sec = 'Commodities'
                  else if (assetType.includes('mutual')) sec = 'Mutual Funds'
                  else if (assetType.includes('etf')) sec = 'ETFs'
                  else if (assetType.includes('gold')) sec = 'Gold'
                  else if (assetType.includes('index')) sec = 'Indices'
                  else if (assetType.includes('bond') || assetType.includes('debt')) sec = 'Bonds'
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
              else if (nameUpper.match(/KOTAK/)) group = 'Kotak Group'
              
              if (group !== 'Others') groupMap[group] = (groupMap[group] || 0) + val
          }
      })

      const unrealized = valTotal - costTotal 
      const totalProfit = unrealized + totalRealizedPnL + totalDividends
      const xirrTotal = (flowsTotal.length > 0 || valTotal > 0) ? calculateXIRR(flowsTotal, valTotal) : 0
      const xirrEq = (flowsEquity.length > 0 || valEq > 0) ? calculateXIRR(flowsEquity, valEq) : 0
      const xirrComm = (flowsComm.length > 0 || valComm > 0) ? calculateXIRR(flowsComm, valComm) : 0

      // Calculate Stats for Equity vs Commodity separately for charts
      const calcStats = (inv: number, curr: number, day: number) => {
          const unrealized = curr - inv
          const pct = inv > 0 ? (unrealized / inv) * 100 : 0
          return { invested: inv, current: curr, unrealizedPnl: unrealized, pnlPercent: pct, dayPnl: day }
      }
      
      // Note: dayPnl is calculated inside the loop above in your original code, but variables equity.dayPnl/commodity.dayPnl were used but not shown in this snippet. 
      // Assuming equity/commodity stats are calculated. I will reconstruct them here for the return object.
      // Ideally, the 'equity' and 'commodity' objects from your original Step D should be returned.
      // Re-implementing Step D variables for completeness:
      const equity = { invested: 0, current: 0, dayPnl: 0 }
      const commodity = { invested: 0, current: 0, dayPnl: 0 }
      
      Object.keys(portfolio).forEach(ticker => {
          const h = portfolio[ticker]
          if (h.quantity > 0) {
             const cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
             let price = priceMap[ticker]?.price
             if (!price) {
                 const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
                 if (foundKey) price = priceMap[foundKey]?.price
             }
             price = price || 0
             const val = h.quantity * price
             const changePercent = priceMap[ticker]?.change || 0
             const prevPrice = price / (1 + (changePercent / 100))
             const dayChange = (price - prevPrice) * h.quantity
             
             const cat = getCategory(h.type)
             if (cat === 'commodity') {
                 commodity.invested += h.totalInvested
                 commodity.current += val
                 commodity.dayPnl += dayChange
             } else {
                 equity.invested += h.totalInvested
                 equity.current += val
                 equity.dayPnl += dayChange
             }
          }
      })

      const eqStats = calcStats(equity.invested, equity.current, equity.dayPnl)
      const commStats = calcStats(commodity.invested, commodity.current, commodity.dayPnl)

      const finalMetrics = {
        totalXirr: xirrTotal, equityXirr: xirrEq, commXirr: xirrComm,
        netWorth: valTotal, unrealized: unrealized, realized: totalRealizedPnL + totalDividends,
        totalProfit: totalProfit, investment: costTotal, currentVal: valTotal, xirr: xirrTotal 
      }

      const formattedSectors = Object.keys(sectorMap)
        .map(k => ({ name: k, value: sectorMap[k] }))
        .sort((a, b) => b.value - a.value)
      
      const formattedGroups = Object.keys(groupMap)
        .map(k => ({ name: k, value: groupMap[k] }))
        .sort((a, b) => b.value - a.value)

      const topHoldings = Object.values(portfolio).filter((h:any) => h.quantity > 0)
          .map((h:any) => ({ ticker: h.ticker, value: h.quantity * (priceMap[h.ticker]?.price || 0) }))
          .sort((a, b) => b.value - a.value).slice(0, 5)

      const summary = { 
          totalValue: valTotal, totalProfit: totalProfit, xirr: xirrTotal.toFixed(2), 
          sectors: formattedSectors, holdings: topHoldings 
      }

      // --- 3. RETURN STATS DETAILS FOR CHART ---
      return { 
          metrics: finalMetrics, 
          sectorData: formattedSectors, 
          conglomerateData: formattedGroups, 
          aiSummary: summary,
          statsDetails: { equity: eqStats, commodity: commStats } // <--- Expose for chart
      }

  }, [transactions, priceMap, dividendMap]) // Added dividendMap dependency

  const isLoading = txnsLoading || pricesLoading || divLoading

  // --- 4. PREPARE CHART DATA ---
  const chartDataPoints = chartCategory === 'equity' ? equityHistory : commHistory
  const chartCurrentValue = chartCategory === 'equity' ? statsDetails.equity.current : statsDetails.commodity.current

  if (txnsLoading && !metrics) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  // Helper for Masking
  const formatVal = (val: number) => '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 })

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. CHART (CONNECTED TO NEW HOOK & CURRENT VALUE) */}
      <PortfolioHistoryChart 
         data={chartDataPoints} 
         isLoading={isLoading} 
         category={chartCategory}
         currentValue={chartCurrentValue} // <--- Fixes the end-point
         onRangeChange={(r) => {}} // Range handled inside component now
         onCategoryChange={setChartCategory}
      />

      {/* 2. METRICS CARDS */}
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

      {/* 3. AI ANALYST */}
      {aiSummary && <AIAnalyst data={aiSummary} />}

      {/* 4. FINANCIAL SUMMARY */}
      {metrics && (
        <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Net Worth</h4>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatVal(metrics.currentVal)}</div>
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

      {/* 5. RISK ANALYSIS (UNCHANGED) */}
      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Risk Analysis</h3>
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* SECTOR EXPOSURE */}
        <div className="min-h-[500px] md:h-[450px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            <h3 className="mb-4 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" /> Sector Exposure
            </h3>
            
            <div className="flex-1 min-h-0 relative [&_*:focus]:outline-none">
                <div className="absolute inset-0 flex flex-col">
                    <div className="flex-1 relative" style={{ minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={sectorData} 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={70} 
                                    outerRadius={90} 
                                    paddingAngle={2} 
                                    dataKey="value"
                                    activeShape={renderActiveShape} 
                                    style={{ outline: 'none' }}
                                >
                                    {sectorData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={COLORS[index % COLORS.length]} 
                                            strokeWidth={0}
                                            style={{ outline: 'none' }} 
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} position={{ x: 10, y: 10 }} wrapperStyle={{ zIndex: 1000 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-[50]">
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Total</p>
                            <p className="text-base font-bold text-slate-800 dark:text-white whitespace-nowrap">
                                {(metrics.netWorth / 100000).toFixed(2)}L
                            </p>
                        </div>
                    </div>
                    <div className="pt-4 pb-2 overflow-auto" style={{ maxHeight: '120px' }}>
                        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px]">
                            {sectorData.map((entry, index) => (
                                <div key={`legend-${index}`} className="flex items-center gap-1">
                                    <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <span className="text-slate-600 dark:text-slate-400">{entry.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* CONGLOMERATE RADAR */}
        <div className="h-[450px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-amber-500" /> Conglomerate Radar
                </h3>
                <Info className="h-4 w-4 text-slate-400" />
            </div>
            
            <div className="flex-1 min-h-0 [&_*:focus]:outline-none">
                {conglomerateData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={conglomerateData} 
                            layout="vertical" 
                            margin={{ left: 10, right: 30, top: 10, bottom: 10 }}
                            barCategoryGap="20%"
                        >
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#8b5cf6" />
                                    <stop offset="100%" stopColor="#6366f1" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#f1f5f9" opacity={0.4} />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={100} 
                                tick={{fontSize: 12, fill: '#64748b', fontWeight: 600}} 
                                axisLine={false} 
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                            <Bar 
                                dataKey="value" 
                                fill="url(#barGradient)" 
                                radius={[0, 6, 6, 0]} 
                                barSize={20} 
                                animationDuration={1500}
                                style={{ outline: 'none' }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400 text-sm bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Briefcase className="h-12 w-12 mb-3 opacity-20" />
                        <p>No major conglomerate exposure found.</p>
                    </div>
                )}
            </div>
        </div>

      </div>

      {/* HEALTH (UNCHANGED) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 mt-6">
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