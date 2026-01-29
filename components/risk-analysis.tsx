'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ShieldAlert, Activity, TrendingDown, Layers, Info, HelpCircle } from 'lucide-react'

type Props = {
    metrics: { beta: number; sharpe: number; maxDrawdown: number; stdDev: number }
    drawdownCurve: any[]
    correlationMatrix: { x: string; y: string; value: number }[]
    tickers: string[]
}

export default function RiskAnalysis({ metrics, drawdownCurve, correlationMatrix, tickers }: Props) {
    
    const getHeatmapColor = (val: number) => {
        if (val === 1) return 'bg-indigo-600'
        if (val > 0.7) return 'bg-red-500'
        if (val > 0.3) return 'bg-red-300'
        if (val > -0.3) return 'bg-slate-100 dark:bg-slate-800'
        if (val > -0.7) return 'bg-green-300'
        return 'bg-green-500'
    }

    return (
        <div className="space-y-6">
            
            {/* 1. METRICS CARDS WITH EXPLANATIONS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                    label="Portfolio Beta" 
                    value={`${metrics.beta.toFixed(2)}x`} 
                    sub="vs NIFTY 50" 
                    icon={Activity}
                    color={metrics.beta > 1.2 ? 'text-orange-600' : 'text-green-600'}
                    explanation="Measures volatility vs the market. Beta > 1 means your portfolio is more aggressive/volatile than NIFTY 50. Beta < 1 means it is more stable/defensive."
                />
                <MetricCard 
                    label="Sharpe Ratio" 
                    value={metrics.sharpe.toFixed(2)} 
                    sub="Risk-Adjusted Rtn" 
                    icon={ShieldAlert}
                    color={metrics.sharpe > 1 ? 'text-green-600' : 'text-slate-600'}
                    explanation="Are you getting paid for your risk? A ratio > 1 is good. A ratio > 2 is excellent. If < 1, you are taking too much risk for too little return."
                />
                <MetricCard 
                    label="Max Drawdown" 
                    value={`-${metrics.maxDrawdown.toFixed(1)}%`} 
                    sub="Deepest Loss" 
                    icon={TrendingDown}
                    color="text-red-600"
                    explanation="The single largest drop your portfolio has ever experienced from a peak to a trough. It represents the 'worst case' pain you have endured."
                />
                <MetricCard 
                    label="Annual Volatility" 
                    value={`${(metrics.stdDev * 100).toFixed(1)}%`} 
                    sub="Fluctuation" 
                    icon={Layers}
                    color="text-indigo-600"
                    explanation="Standard Deviation. It shows how widely your returns swing. Higher volatility means higher uncertainty and risk."
                />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                
                {/* 2. DRAWDOWN CHART */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">Underwater Plot</h3>
                        <div className="group relative">
                            <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                            <div className="absolute right-0 top-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                This chart visualizes your "pain periods". It shows how far below the all-time high your portfolio was at any given point.
                            </div>
                        </div>
                    </div>
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
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white">Correlation Matrix</h3>
                        <div className="group relative">
                            <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                            <div className="absolute right-0 top-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <p className="mb-1"><span className="text-red-400 font-bold">Red (High +ve):</span> Assets move together. (Riskier)</p>
                                <p><span className="text-green-400 font-bold">Green (Low/Neg):</span> Assets move differently. (Better Diversification)</p>
                            </div>
                        </div>
                    </div>
                    
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
                                                    className={`h-8 w-full rounded flex items-center justify-center text-[9px] font-medium text-white/90 ${getHeatmapColor(val)} cursor-default transition-transform hover:scale-105`}
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

function MetricCard({ label, value, sub, icon: Icon, color, explanation }: any) {
    return (
        <div className="group relative rounded-xl border border-slate-200 bg-slate-50 p-4 dark:bg-slate-800/50 dark:border-slate-700 hover:border-indigo-300 transition-colors">
            
            {/* Tooltip Popup */}
            {explanation && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                    {explanation}
                    {/* Tiny triangle pointer */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}

            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs font-bold text-slate-500 uppercase">{label}</span>
                </div>
                {/* Info Icon Indicator */}
                <Info className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
        </div>
    )
}