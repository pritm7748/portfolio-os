// components/portfolio-history-chart.tsx
'use client'

import { useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, ComposedChart } from 'recharts'
import { Loader2, TrendingUp, TrendingDown, Trophy, Target } from 'lucide-react'

type ChartDataPoint = {
    date: string
    invested: number
    value: number
    benchmark?: number
    portfolioReturn?: number
    benchmarkReturn?: number
}

type Props = {
    data: ChartDataPoint[]
    onRangeChange: (range: string) => void
    onCategoryChange: (category: 'equity' | 'commodity') => void
    isLoading: boolean
    category: 'equity' | 'commodity'
    showBenchmark?: boolean
    benchmarkName?: string
    alpha?: number
    portfolioReturn?: number
    benchmarkReturn?: number
}

export default function PortfolioHistoryChart({ 
    data, 
    onRangeChange, 
    onCategoryChange, 
    isLoading, 
    category,
    showBenchmark = false,
    benchmarkName = 'NIFTY 50',
    alpha = 0,
    portfolioReturn = 0,
    benchmarkReturn = 0
}: Props) {
    const [activeRange, setActiveRange] = useState('1y')
    const [viewMode, setViewMode] = useState<'value' | 'returns'>('value')

    const handleRange = (r: string) => {
        setActiveRange(r)
        onRangeChange(r === 'all' ? 'max' : r)
    }

    // Dynamic Colors based on Category
    const portfolioColor = category === 'equity' ? '#6366f1' : '#f59e0b'
    const benchmarkColor = '#10b981'
    const gradientId = category === 'equity' ? 'colorEq' : 'colorComm'

    // Determine if beating benchmark
    const isBeatingBenchmark = alpha > 0

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const netWorthItem = payload.find((p: any) => p.dataKey === 'value')
            const investedItem = payload.find((p: any) => p.dataKey === 'invested')
            const benchmarkItem = payload.find((p: any) => p.dataKey === 'benchmark')
            const portfolioReturnItem = payload.find((p: any) => p.dataKey === 'portfolioReturn')
            const benchmarkReturnItem = payload.find((p: any) => p.dataKey === 'benchmarkReturn')

            return (
                <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg text-sm min-w-[180px]">
                    <p className="font-medium text-slate-600 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                        {new Date(label).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                    
                    {viewMode === 'value' ? (
                        <div className="space-y-1.5">
                            {netWorthItem && (
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: portfolioColor }}></span>
                                        Portfolio
                                    </span>
                                    <span className="font-bold" style={{ color: portfolioColor }}>
                                        ₹{netWorthItem.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                            )}
                            {investedItem && (
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500 text-xs">Invested</span>
                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                        ₹{investedItem.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                            )}
                            {benchmarkItem && showBenchmark && (
                                <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: benchmarkColor }}></span>
                                        {benchmarkName}
                                    </span>
                                    <span className="font-medium" style={{ color: benchmarkColor }}>
                                        ₹{benchmarkItem.value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {portfolioReturnItem && (
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: portfolioColor }}></span>
                                        Your Return
                                    </span>
                                    <span className={`font-bold ${portfolioReturnItem.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {portfolioReturnItem.value >= 0 ? '+' : ''}{portfolioReturnItem.value?.toFixed(1)}%
                                    </span>
                                </div>
                            )}
                            {benchmarkReturnItem && showBenchmark && (
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: benchmarkColor }}></span>
                                        {benchmarkName}
                                    </span>
                                    <span className={`font-medium ${benchmarkReturnItem.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {benchmarkReturnItem.value >= 0 ? '+' : ''}{benchmarkReturnItem.value?.toFixed(1)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }
        return null
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="flex flex-col gap-4">
                
                {/* Header Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Portfolio Performance</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {showBenchmark ? `Compare your returns against ${benchmarkName}` : 'Track value vs investment over time'}
                        </p>
                    </div>

                    {/* Category Switcher */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start lg:self-auto">
                        <button
                            onClick={() => onCategoryChange('equity')}
                            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                                category === 'equity'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            Equity & MF
                        </button>
                        <button
                            onClick={() => onCategoryChange('commodity')}
                            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                                category === 'commodity'
                                ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            Commodity
                        </button>
                    </div>
                </div>

                {/* Alpha Card - Only show for equity with benchmark */}
                {showBenchmark && category === 'equity' && data.length > 0 && (
                    <div className={`flex flex-wrap items-center gap-4 p-4 rounded-xl border ${
                        isBeatingBenchmark 
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30' 
                            : 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30'
                    }`}>
                        <div className={`p-2 rounded-full ${isBeatingBenchmark ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                            {isBeatingBenchmark ? (
                                <Trophy className={`h-5 w-5 ${isBeatingBenchmark ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                            ) : (
                                <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            )}
                        </div>
                        
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {isBeatingBenchmark 
                                    ? `🎉 You're beating ${benchmarkName}!` 
                                    : `${benchmarkName} is ahead`
                                }
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {isBeatingBenchmark 
                                    ? 'Your stock picks are outperforming the market' 
                                    : 'Consider reviewing underperforming holdings'
                                }
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-6">
                            <div className="text-center">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Your Return</div>
                                <div className={`text-lg font-bold ${portfolioReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(1)}%
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">{benchmarkName}</div>
                                <div className={`text-lg font-bold ${benchmarkReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(1)}%
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Alpha</div>
                                <div className={`text-lg font-bold ${alpha >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls Row */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* View Mode Toggle (only when benchmark is shown) */}
                    {showBenchmark && (
                        <div className="flex bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('value')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                    viewMode === 'value' 
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                            >
                                Absolute Value
                            </button>
                            <button
                                onClick={() => setViewMode('returns')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                    viewMode === 'returns' 
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                            >
                                % Returns
                            </button>
                        </div>
                    )}

                    {/* Time Range Selector */}
                    <div className="flex bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1 ml-auto">
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

            {/* Chart */}
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
                        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={portfolioColor} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={portfolioColor} stopOpacity={0.05}/>
                                </linearGradient>
                                <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={benchmarkColor} stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor={benchmarkColor} stopOpacity={0.02}/>
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
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fill: '#94a3b8'}}
                                tickFormatter={(val) => {
                                    if (viewMode === 'returns') return `${val.toFixed(0)}%`
                                    return `₹${(val/1000).toFixed(0)}k`
                                }}
                                width={50}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                verticalAlign="top" 
                                height={36} 
                                iconType="circle" 
                                wrapperStyle={{ fontSize: '12px', paddingTop: '0px' }}
                            />
                            
                            {viewMode === 'value' ? (
                                <>
                                    {/* Portfolio Value */}
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        name="Your Portfolio" 
                                        stroke={portfolioColor} 
                                        fill={`url(#${gradientId})`} 
                                        strokeWidth={2.5} 
                                    />
                                    
                                    {/* Invested (Dashed Line) */}
                                    <Line 
                                        type="stepAfter" 
                                        dataKey="invested" 
                                        name="Amount Invested" 
                                        stroke="#94a3b8" 
                                        strokeWidth={2} 
                                        strokeDasharray="5 5"
                                        dot={false}
                                    />

                                    {/* Benchmark (if enabled) */}
                                    {showBenchmark && (
                                        <Area 
                                            type="monotone" 
                                            dataKey="benchmark" 
                                            name={benchmarkName}
                                            stroke={benchmarkColor} 
                                            fill="url(#colorBenchmark)" 
                                            strokeWidth={2} 
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Portfolio Returns % */}
                                    <Area 
                                        type="monotone" 
                                        dataKey="portfolioReturn" 
                                        name="Your Return %" 
                                        stroke={portfolioColor} 
                                        fill={`url(#${gradientId})`} 
                                        strokeWidth={2.5} 
                                    />

                                    {/* Benchmark Returns % */}
                                    {showBenchmark && (
                                        <Area 
                                            type="monotone" 
                                            dataKey="benchmarkReturn" 
                                            name={`${benchmarkName} %`}
                                            stroke={benchmarkColor} 
                                            fill="url(#colorBenchmark)" 
                                            strokeWidth={2} 
                                        />
                                    )}
                                </>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}