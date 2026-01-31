'use client'

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from 'recharts'
import { Info } from 'lucide-react'

type AssetPoint = {
    ticker: string
    return: number // Y-Axis (CAGR)
    risk: number   // X-Axis (Volatility)
    weight: number // Z-Axis (Bubble Size)
    name: string
}

type Props = {
    data: AssetPoint[]
}

export default function EfficiencyPlot({ data }: Props) {
    // Calculate averages for the "Crosshair" reference lines
    const avgReturn = data.reduce((sum, item) => sum + item.return, 0) / data.length
    const avgRisk = data.reduce((sum, item) => sum + item.risk, 0) / data.length

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload
            return (
                <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs z-50 min-w-[150px]">
                    <p className="font-bold text-slate-800 dark:text-white mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                        {d.ticker}
                    </p>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Return:</span>
                            <span className={`font-bold ${d.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {d.return.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Risk (Vol):</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                {d.risk.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Weight:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                {d.weight.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            )
        }
        return null
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        Efficiency Matrix
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Risk vs. Return for individual holdings.
                    </p>
                </div>
                <div className="group relative">
                    <Info className="h-4 w-4 text-slate-400 cursor-help" />
                    <div className="absolute right-0 top-6 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        <ul className="list-disc pl-3 space-y-1">
                            <li><span className="text-green-400 font-bold">Top Left:</span> High Return, Low Risk (Stars)</li>
                            <li><span className="text-red-400 font-bold">Bottom Right:</span> Low Return, High Risk (Avoid)</li>
                            <li>Bubble size represents portfolio weight.</li>
                        </ul>
                        {/* Tooltip Arrow */}
                        <div className="absolute top-full right-1 -translate-y-full border-4 border-transparent border-t-slate-800"></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis 
                            type="number" 
                            dataKey="risk" 
                            name="Risk" 
                            unit="%" 
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            label={{ value: 'Risk (Volatility)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#64748b' }} 
                        />
                        <YAxis 
                            type="number" 
                            dataKey="return" 
                            name="Return" 
                            unit="%" 
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            label={{ value: 'Annual Return', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
                        />
                        <ZAxis type="number" dataKey="weight" range={[50, 400]} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        
                        {/* Quadrant Lines (Average Risk/Return) */}
                        <ReferenceLine x={avgRisk} stroke="#94a3b8" strokeDasharray="3 3" />
                        <ReferenceLine y={avgReturn} stroke="#94a3b8" strokeDasharray="3 3" />

                        <Scatter name="Assets" data={data}>
                            {data.map((entry, index) => {
                                // Dynamic Color Logic
                                let color = '#6366f1' // Default Indigo
                                if (entry.return > avgReturn && entry.risk < avgRisk) color = '#22c55e' // Green (Star)
                                if (entry.return < avgReturn && entry.risk > avgRisk) color = '#ef4444' // Red (Toxic)
                                
                                return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.7} stroke={color} />
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}