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
import { useTransactions, useLivePrices } from '@/hooks/use-portfolio-data'

// --- CONFIGURATION ---
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#64748b']

type ChartDataPoint = { date: string; invested: number; value: number }

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

// --- HELPER: STATIC ACTIVE SHAPE (Prevents Expansion) ---
// This forces the slice to stay the exact same size on hover
const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    return (
        <Sector
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius} // Keep original radius (No expansion)
            startAngle={startAngle}
            endAngle={endAngle}
            fill={fill}
            style={{ outline: 'none' }} // Ensure no focus ring
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

  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartCategory, setChartCategory] = useState<'equity' | 'commodity'>('equity')
  const [currentRange, setCurrentRange] = useState('1y')

  const getCategory = (type: string) => {
      const t = type.toLowerCase()
      if (t.includes('commodity') || t.includes('gold') || t.includes('silver') || t.includes('currency')) return 'commodity'
      return 'equity'
  }

  // --- CALCULATION ENGINE ---
  const { metrics, sectorData, conglomerateData, aiSummary } = useMemo(() => {
      const emptyMetrics = { totalXirr: 0, equityXirr: 0, commXirr: 0, netWorth: 0, unrealized: 0, realized: 0, totalProfit: 0, investment: 0, currentVal: 0, xirr: 0 }
      
      if (!transactions || !priceMap) return { metrics: emptyMetrics, sectorData: [], conglomerateData: [], aiSummary: null }

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

              // Sector Logic
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

              // Conglomerate
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

      return { metrics: finalMetrics, sectorData: formattedSectors, conglomerateData: formattedGroups, aiSummary: summary }

  }, [transactions, priceMap])


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
        const lastKnownPrices: Record<string, number> = {} 
        
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

            const daysPrices = priceLookup[date] || {}
            Object.keys(daysPrices).forEach(t => {
                if (daysPrices[t] > 0) lastKnownPrices[t] = daysPrices[t]
            })

            let dailyValue = 0
            Object.keys(runningHoldings).forEach(ticker => {
                const qty = runningHoldings[ticker]
                if (qty > 0) { 
                    const price = daysPrices[ticker] || lastKnownPrices[ticker] || 0
                    if (price > 0) dailyValue += (qty * price) 
                }
            })

            if (runningInvested > 0 || dailyValue > 0) {
                finalChartData.push({ date, invested: Math.max(0, runningInvested), value: dailyValue })
            }
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

      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Risk Analysis</h3>
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* 1. SECTOR EXPOSURE */}
        <div className="min-h-[520px] md:h-[480px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
            {/* Added Extra Spacing for Mobile Header */}
            <h3 className="mb-12 md:mb-6 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" /> Sector Exposure
            </h3>
            
            <div className="flex-1 min-h-0 relative pb-4 [&_*:focus]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 0, bottom: 80, left: 0 }}>
                        <Pie 
                            data={sectorData} 
                            cx="50%" cy="50%" 
                            innerRadius={100}  // Expanded hole for desktop safety
                            outerRadius={125} 
                            paddingAngle={2} 
                            dataKey="value"
                            activeShape={renderActiveShape} // Disables expansion on hover
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
                        <Tooltip 
                            content={<CustomTooltip />} 
                            position={{ x: 10, y: 10 }}
                        />
                        <Legend 
                            layout="horizontal" 
                            verticalAlign="bottom" 
                            align="center" 
                            wrapperStyle={{fontSize: '11px', paddingTop: '24px'}} 
                            iconSize={8} 
                            iconType="circle" 
                        />
                    </PieChart>
                </ResponsiveContainer>
                
                {/* Center Label - Perfectly Centered & Safe */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Total</p>
                    <p className="text-base font-bold text-slate-800 dark:text-white whitespace-nowrap">
                        ₹{(metrics.netWorth / 100000).toFixed(2)}L
                    </p>
                </div>
            </div>
        </div>

        {/* 2. CONGLOMERATE RADAR */}
        <div className="h-[480px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col">
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
                                activeBar= {false}
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
