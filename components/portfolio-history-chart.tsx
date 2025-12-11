'use client'

import { useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Loader2 } from 'lucide-react'

type ChartDataPoint = {
    date: string
    invested: number
    value: number
}

type Props = {
    data: ChartDataPoint[]
    onRangeChange: (range: string) => void
    onCategoryChange: (category: 'equity' | 'commodity') => void
    isLoading: boolean
    category: 'equity' | 'commodity'
}

export default function PortfolioHistoryChart({ data, onRangeChange, onCategoryChange, isLoading, category }: Props) {
  const [activeRange, setActiveRange] = useState('1y')

  const handleRange = (r: string) => {
      setActiveRange(r)
      onRangeChange(r === 'all' ? 'max' : r)
  }

  // Dynamic Colors based on Category
  const color = category === 'equity' ? '#6366f1' : '#f59e0b' // Indigo vs Amber
  const gradientId = category === 'equity' ? 'colorEq' : 'colorComm'

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // --- THE FIX: Robust Lookup instead of hardcoded indices ---
      const netWorthItem = payload.find((p: any) => p.dataKey === 'value')
      const investedItem = payload.find((p: any) => p.dataKey === 'invested')

      const netWorthValue = netWorthItem ? netWorthItem.value : 0
      const investedValue = investedItem ? investedItem.value : 0

      return (
        <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg text-sm min-w-[150px]">
          <p className="font-medium text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
            {new Date(label).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
          <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 text-xs">Net Worth:</span>
                <span className="font-bold text-slate-900 dark:text-white" style={{ color: color }}>
                    ₹{netWorthValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 text-xs">Invested:</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">
                    ₹{investedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-col gap-6">
          
          {/* Header Row: Title & Category Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Portfolio Performance</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Track value vs. investment over time.</p>
            </div>

            {/* CATEGORY SWITCHER */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start md:self-auto">
                <button
                    onClick={() => onCategoryChange('equity')}
                    className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                        category === 'equity'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                >
                    Equity & Mutual Funds
                </button>
                <button
                    onClick={() => onCategoryChange('commodity')}
                    className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                        category === 'commodity'
                        ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                >
                    Commodity & Currency
                </button>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex justify-end">
            <div className="flex bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1">
                {['1mo', '6mo', '1y', '5y', 'all'].map((range) => (
                    <button
                        key={range}
                        onClick={() => handleRange(range)}
                        className={`px-3 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-all uppercase ${
                            activeRange === range 
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5' 
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                    >
                        {range}
                    </button>
                ))}
            </div>
          </div>
      </div>

      <div className="h-[350px] w-full relative mt-4">
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10 backdrop-blur-sm rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        )}
        
        {data.length === 0 && !isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                No historical data found for {category === 'equity' ? 'Equity' : 'Commodities'}.
            </div>
        ) : (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#94a3b8'}} 
                        minTickGap={40}
                        tickFormatter={(str) => {
                            const d = new Date(str)
                            if (activeRange === '1mo') return d.getDate() + '/' + (d.getMonth()+1)
                            if (activeRange === 'all' || activeRange === '5y') return d.getFullYear().toString()
                            return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                        }}
                    />
                    <YAxis 
                        hide={false}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#94a3b8'}}
                        tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                        width={45}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '0px' }}/>
                    
                    {/* ORDER MATTERS: Put Net Worth FIRST so it's behind Invested if they overlap? 
                        Usually you want the biggest area first if using opacity, or vice versa. 
                        Let's keep your original order but fix the tooltip lookup. */}
                    
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        name="Net Worth" 
                        stroke={color} 
                        fill={`url(#${gradientId})`} 
                        strokeWidth={2} 
                    />
                    
                    <Area 
                        type="step" 
                        dataKey="invested" 
                        name="Invested" 
                        stroke="#94a3b8" 
                        fill="transparent"
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        activeDot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}