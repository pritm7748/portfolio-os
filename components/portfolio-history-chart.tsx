'use client'

import { useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from 'recharts'
import { Loader2 } from 'lucide-react'

type ChartDataPoint = {
    date: string
    invested: number
    equity: number
    commodity: number
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
      // Map 'all' UI option to 'max' API parameter
      onRangeChange(r === 'all' ? 'max' : r)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Calculate Total Net Worth for tooltip
      const eq = payload.find((p: any) => p.name === 'Equity')?.value || 0
      const comm = payload.find((p: any) => p.name === 'Commodity')?.value || 0
      const total = eq + comm
      const invested = payload.find((p: any) => p.name === 'Invested')?.value || 0

      return (
        <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg text-sm min-w-[180px]">
          <p className="font-medium text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
            {new Date(label).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
          
          <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Net Worth:</span>
                <span className="font-bold text-slate-900 dark:text-white">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Invested:</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">₹{invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
              
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-slate-500">Equity:</span>
                <span className="ml-auto font-medium text-indigo-600 dark:text-indigo-400">₹{eq.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-500">Commodity:</span>
                <span className="ml-auto font-medium text-amber-600 dark:text-amber-400">₹{comm.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Portfolio Growth</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Net Worth split by asset class vs. Investment</p>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 self-start">
              {['1mo', '6mo', '1y', '5y', 'all'].map((range) => (
                  <button
                    key={range}
                    onClick={() => handleRange(range)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all uppercase ${
                        activeRange === range 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                      {range}
                  </button>
              ))}
          </div>
      </div>

      <div className="h-[350px] w-full relative">
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10 backdrop-blur-sm rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        )}
        
        {data.length === 0 && !isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                No historical data available.
            </div>
        ) : (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
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
                    
                    {/* Stacked Areas for Value */}
                    <Area 
                        type="monotone" 
                        dataKey="commodity" 
                        name="Commodity" 
                        stackId="1"
                        stroke="#f59e0b" 
                        fill="url(#colorComm)" 
                        strokeWidth={2} 
                    />
                    <Area 
                        type="monotone" 
                        dataKey="equity" 
                        name="Equity" 
                        stackId="1"
                        stroke="#6366f1" 
                        fill="url(#colorEq)" 
                        strokeWidth={2} 
                    />
                    
                    {/* Line for Invested Amount */}
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