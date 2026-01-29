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
        // Self Correlation (1.0) -> Neutral Dark
        if (val >= 0.99) return 'bg-slate-800 text-white' 
        
        // High Positive -> Red (Danger/High Correlation)
        if (val > 0.7) return 'bg-red-500 text-white'
        if (val > 0.5) return 'bg-red-400 text-white'
        if (val > 0.3) return 'bg-red-200 text-slate-800'
        
        // Neutral -> Grey
        if (val > -0.3) return 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        
        // Negative -> Green (Hedge/Good Diversification)
        if (val > -0.7) return 'bg-green-200 text-slate-800'
        return 'bg-green-500 text-white'
    }

    // Helper to clean ticker names (RELIANCE.NS -> RELIANCE)
    const cleanName = (t: string) => t.replace('.NS', '').replace('.BO', '').replace(':NSE', '')

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
                    <div className="h-[350px]">
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

                {/* 3. CORRELATION HEATMAP (SCROLLABLE & FULL) */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-800 dark:text-white">Correlation Matrix</h3>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                {tickers.length} Stocks
                             </span>
                            <div className="group relative">
                                <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                                <div className="absolute right-0 top-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    <p className="mb-1"><span className="text-red-400 font-bold">Red (High +ve):</span> Assets move together. (Riskier)</p>
                                    <p><span className="text-green-400 font-bold">Green (Low/Neg):</span> Assets move differently. (Better Diversification)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* SCROLLABLE CONTAINER */}
                    {tickers.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">
                            No stock data available for correlation.
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto max-h-[400px] border border-slate-100 dark:border-slate-800 rounded-lg">
                            {/* Matrix Container - Inline Grid to force content width */}
                            <div className="inline-grid gap-1 p-2" style={{ gridTemplateColumns: `auto repeat(${tickers.length}, 40px)` }}>
                                
                                {/* TOP LEFT CORNER (Empty) */}
                                <div className="h-24 bg-transparent sticky left-0 top-0 z-20 bg-white dark:bg-slate-900"></div>

                                {/* COLUMN HEADERS (Rotated & Sticky Top) */}
                                {tickers.map(t => (
                                    <div key={`col-${t}`} className="h-24 w-10 flex items-end justify-center pb-2 sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-slate-500 -rotate-90 origin-bottom-left translate-x-2.5 whitespace-nowrap">
                                            {cleanName(t).substring(0, 10)}
                                        </span>
                                    </div>
                                ))}

                                {/* MATRIX ROWS */}
                                {tickers.map((rowTicker) => (
                                    <>
                                        {/* ROW LABEL (Sticky Left) */}
                                        <div key={`row-${rowTicker}`} className="h-10 flex items-center justify-end pr-3 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {cleanName(rowTicker).substring(0, 12)}
                                            </span>
                                        </div>

                                        {/* ROW CELLS */}
                                        {tickers.map((colTicker) => {
                                            const cell = correlationMatrix.find(c => c.x === rowTicker && c.y === colTicker)
                                            const val = cell?.value || 0
                                            return (
                                                <div 
                                                    key={`${rowTicker}-${colTicker}`}
                                                    className={`h-10 w-10 rounded-md flex items-center justify-center text-[10px] font-medium transition-transform hover:scale-110 cursor-default shadow-sm ${getHeatmapColor(val)}`}
                                                    title={`${cleanName(rowTicker)} vs ${cleanName(colTicker)}: ${val.toFixed(2)}`}
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
            {explanation && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                    {explanation}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs font-bold text-slate-500 uppercase">{label}</span>
                </div>
                <Info className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
        </div>
    )
}