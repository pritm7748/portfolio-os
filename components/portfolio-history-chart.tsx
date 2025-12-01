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
    isLoading: boolean
}

export default function PortfolioHistoryChart({ data, onRangeChange, isLoading }: Props) {
  const [activeRange, setActiveRange] = useState('1y')

  const handleRange = (r: string) => {
      setActiveRange(r)
      onRangeChange(r)
  }

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg text-sm">
          <p className="font-medium text-slate-600 dark:text-slate-400 mb-2">{new Date(label).toLocaleDateString()}</p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-500 capitalize">{entry.name}:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                    ₹{entry.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Portfolio Performance</h3>
          
          {/* Time Range Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 self-start">
              {['1mo', '6mo', '1y', '5y'].map((range) => (
                  <button
                    key={range}
                    onClick={() => handleRange(range)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        activeRange === range 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                      {range.toUpperCase()}
                  </button>
              ))}
          </div>
      </div>

      <div className="h-[300px] w-full relative">
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        )}
        
        {data.length === 0 && !isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                Not enough data to generate chart.
            </div>
        ) : (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#94a3b8'}} 
                        minTickGap={30}
                        tickFormatter={(str) => {
                            const d = new Date(str)
                            return activeRange === '1mo' ? d.getDate() + '/' + (d.getMonth()+1) : 
                                   activeRange === '1y' ? d.toLocaleDateString('en-IN', { month: 'short' }) :
                                   d.getFullYear().toString()
                        }}
                    />
                    <YAxis 
                        hide={false}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#94a3b8'}}
                        tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                        width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    
                    <Area 
                        type="monotone" 
                        dataKey="invested" 
                        name="Invested" 
                        stroke="#94a3b8" 
                        fill="transparent" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        activeDot={false}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        name="Net Worth" 
                        stroke="#6366f1" 
                        fill="url(#colorValue)" 
                        strokeWidth={2} 
                    />
                </AreaChart>
            </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}