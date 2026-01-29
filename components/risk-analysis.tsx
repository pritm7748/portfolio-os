'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ShieldAlert, Activity, TrendingDown, Layers } from 'lucide-react'

type Props = {
    metrics: { beta: number; sharpe: number; maxDrawdown: number; stdDev: number }
    drawdownCurve: any[]
    correlationMatrix: { x: string; y: string; value: number }[]
    tickers: string[]
}

export default function RiskAnalysis({ metrics, drawdownCurve, correlationMatrix, tickers }: Props) {
    
    // Helper to get color for correlation
    const getHeatmapColor = (val: number) => {
        if (val === 1) return 'bg-indigo-600' // Self
        if (val > 0.7) return 'bg-red-500' // High +ve
        if (val > 0.3) return 'bg-red-300' // Moderate +ve
        if (val > -0.3) return 'bg-slate-100 dark:bg-slate-800' // Neutral
        if (val > -0.7) return 'bg-green-300' // Moderate -ve
        return 'bg-green-500' // High -ve (Good hedge)
    }

    return (
        <div className="space-y-6">
            
            {/* 1. METRICS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                    label="Portfolio Beta" 
                    value={`${metrics.beta.toFixed(2)}x`} 
                    sub="vs NIFTY 50" 
                    icon={Activity}
                    color={metrics.beta > 1.2 ? 'text-orange-600' : 'text-green-600'}
                />
                <MetricCard 
                    label="Sharpe Ratio" 
                    value={metrics.sharpe.toFixed(2)} 
                    sub="Risk-Adjusted Rtn" 
                    icon={ShieldAlert}
                    color={metrics.sharpe > 1 ? 'text-green-600' : 'text-slate-600'}
                />
                <MetricCard 
                    label="Max Drawdown" 
                    value={`-${metrics.maxDrawdown.toFixed(1)}%`} 
                    sub="Deepest Loss" 
                    icon={TrendingDown}
                    color="text-red-600"
                />
                <MetricCard 
                    label="Annual Volatility" 
                    value={`${(metrics.stdDev * 100).toFixed(1)}%`} 
                    sub="Fluctuation" 
                    icon={Layers}
                    color="text-indigo-600"
                />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                
                {/* 2. DRAWDOWN CHART */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4">Underwater Plot (Drawdown)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={drawdownCurve}>
                                <defs>
                                    <linearGradient id="colorDd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                <XAxis dataKey="date" hide />
                                <YAxis tickFormatter={(val) => `${val}%`} style={{ fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px' }} 
                                    formatter={(val: number) => [`${val.toFixed(2)}%`, 'Drawdown']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                />
                                <Area type="step" dataKey="value" stroke="#ef4444" fill="url(#colorDd)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. CORRELATION HEATMAP */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4">Correlation Matrix</h3>
                    
                    {tickers.length > 10 ? (
                        <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">
                            Too many assets for heatmap. Select top 10 in settings.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="grid gap-1" style={{ gridTemplateColumns: `30px repeat(${tickers.length}, 1fr)` }}>
                                {/* Header Row */}
                                <div className="h-8"></div>
                                {tickers.map(t => (
                                    <div key={t} className="h-8 flex items-center justify-center">
                                        <span className="text-[10px] font-bold text-slate-500 -rotate-45 whitespace-nowrap">{t}</span>
                                    </div>
                                ))}

                                {/* Rows */}
                                {tickers.map((rowTicker) => (
                                    <>
                                        {/* Row Label */}
                                        <div key={`label-${rowTicker}`} className="flex items-center justify-end pr-2">
                                            <span className="text-[10px] font-bold text-slate-500">{rowTicker}</span>
                                        </div>
                                        {/* Cells */}
                                        {tickers.map((colTicker) => {
                                            const cell = correlationMatrix.find(c => c.x === rowTicker && c.y === colTicker)
                                            const val = cell?.value || 0
                                            return (
                                                <div 
                                                    key={`${rowTicker}-${colTicker}`}
                                                    className={`h-8 w-full rounded flex items-center justify-center text-[9px] font-medium text-white/90 ${getHeatmapColor(val)}`}
                                                    title={`${rowTicker} vs ${colTicker}: ${val.toFixed(2)}`}
                                                >
                                                    {val.toFixed(1)}
                                                </div>
                                            )
                                        })}
                                    </>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function MetricCard({ label, value, sub, icon: Icon, color }: any) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs font-bold text-slate-500 uppercase">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
        </div>
    )
}