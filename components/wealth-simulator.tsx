'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { runMonteCarlo } from '@/lib/monte-carlo'
import { TrendingUp } from 'lucide-react'

type Props = {
    currentValue: number
    stats: { expectedReturn: number; volatility: number }
}

export default function WealthSimulator({ currentValue, stats }: Props) {
    const [years, setYears] = useState(10)
    const [hoveredPoint, setHoveredPoint] = useState<any>(null)

    // Run Simulation
    const data = useMemo(() => {
        if (!currentValue || currentValue === 0) return []

        const safeReturn = Math.min(Math.max(stats.expectedReturn, 0.08), 0.25) 
        const safeVol = Math.max(stats.volatility, 0.10)

        return runMonteCarlo(currentValue, safeReturn, safeVol, years)
    }, [currentValue, stats, years])

    if (!data || data.length === 0) return null

    const activeData = hoveredPoint || data[data.length - 1]
    const { p10, p50, p90 } = activeData.percentiles
    const activeYear = activeData.year

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-500" /> 
                        Future Wealth Forecast
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        1,000 simulations based on your portfolio's specific volatility.
                    </p>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    {[5, 10, 20].map(y => (
                        <button
                            key={y}
                            onClick={() => { setYears(y); setHoveredPoint(null); }}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                years === y 
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            {y}Y
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                        data={data} 
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        // FIX: Type 'e' as 'any' to bypass missing type definition for activePayload
                        onMouseMove={(e: any) => {
                            if (e && e.activePayload && e.activePayload[0]) {
                                setHoveredPoint(e.activePayload[0].payload)
                            }
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                    >
                        <defs>
                            <linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis 
                            dataKey="year" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tickFormatter={(val) => `₹${(val/100000).toFixed(0)}L`}
                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                            width={40}
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', fontSize: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                            formatter={(val: number, name: string) => {
                                const label = name === 'percentiles.p90' ? 'Optimistic' 
                                            : name === 'percentiles.p50' ? 'Median' 
                                            : 'Pessimistic'
                                return [`₹${(val/100000).toFixed(2)} Lakhs`, label]
                            }}
                            labelFormatter={(label) => `Year: ${label}`}
                        />
                        
                        <Area 
                            type="monotone" 
                            dataKey="percentiles.p90" 
                            stroke="transparent" 
                            fill="url(#colorUncertainty)" 
                            isAnimationActive={false}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="percentiles.p10" 
                            stroke="transparent" 
                            fill="var(--bg-mask)" 
                            className="fill-white dark:fill-slate-900" 
                            isAnimationActive={false}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="percentiles.p50" 
                            stroke="#6366f1" 
                            strokeWidth={3}
                            fill="transparent" 
                            name="Median Forecast"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-sm p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 gap-4 transition-all duration-300">
                <div className="text-slate-500 dark:text-slate-400 text-center sm:text-left">
                    Projected Wealth in <span className="font-bold text-slate-800 dark:text-white transition-colors duration-200">{activeYear}</span>
                </div>
                <div className="text-center sm:text-right">
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 transition-all duration-200">
                        ₹{(p50/100000).toFixed(2)} Lakhs
                    </div>
                    <div className="text-[10px] text-slate-400 transition-all duration-200">
                        Range: ₹{(p10/100000).toFixed(0)}L - ₹{(p90/100000).toFixed(0)}L
                    </div>
                </div>
            </div>
        </div>
    )
}