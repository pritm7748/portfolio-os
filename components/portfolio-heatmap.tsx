'use client'

import { useState, useMemo } from 'react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { Check, Filter } from 'lucide-react'

// Color scale with intensity levels
const getColor = (change: number) => {
    if (change >= 4) return '#15803d'   // Green 700
    if (change >= 2) return '#16a34a'   // Green 600
    if (change >= 0.5) return '#22c55e' // Green 500
    if (change > 0) return '#4ade80'    // Green 400
    if (change === 0) return '#64748b'  // Slate 500
    if (change > -0.5) return '#f87171' // Red 400
    if (change > -2) return '#ef4444'   // Red 500
    if (change > -4) return '#dc2626'   // Red 600
    return '#b91c1c'                     // Red 700
}

// Grouped block colors (muted, distinct)
const GROUP_COLORS: Record<string, string> = {
    'Mutual Funds': '#6366f1', // Indigo
    'Commodities': '#f59e0b',  // Amber
    'Currencies': '#06b6d4',   // Cyan
}

const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, dayChangePercent, isGroup } = props
    const change = dayChangePercent || 0
    const displayName = name || ''

    if (!name || width < 2 || height < 2) return null

    const fill = isGroup ? (GROUP_COLORS[name] || '#64748b') : getColor(change)
    const showTicker = width > 40 && height > 28
    const showChange = width > 50 && height > 42

    return (
        <g>
            <rect
                x={x} y={y} width={width} height={height}
                fill={fill}
                stroke="var(--bg-background, #ffffff)"
                strokeWidth={2}
                className="transition-opacity hover:opacity-80 cursor-pointer dark:stroke-slate-900"
                rx={3}
            />
            {isGroup && (
                <rect
                    x={x} y={y} width={width} height={height}
                    fill="url(#groupPattern)"
                    opacity={0.08}
                    rx={3}
                />
            )}
            {showTicker && (
                <text
                    x={x + width / 2} y={y + height / 2 - (showChange ? 6 : 0)}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#ffffff" fontSize={isGroup ? 12 : 11} fontWeight="bold"
                    className="pointer-events-none drop-shadow-sm"
                >
                    {displayName}
                </text>
            )}
            {showChange && (
                <text
                    x={x + width / 2} y={y + height / 2 + 11}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#ffffff" fontSize={9.5} fontWeight="500"
                    opacity={0.9}
                    className="pointer-events-none"
                >
                    {isGroup
                        ? `${props.count} asset${props.count === 1 ? '' : 's'}`
                        : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`
                    }
                </text>
            )}
        </g>
    )
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload
        const change = d.dayChangePercent || 0
        const pnl = d.pnlPercent || 0

        return (
            <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-xs z-50 min-w-[160px]">
                <p className="font-bold text-slate-800 dark:text-white mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    {d.name || 'Asset'}
                    {d.isGroup && <span className="ml-1.5 text-[10px] font-medium text-slate-400">({d.count} assets)</span>}
                </p>
                <div className="space-y-1.5">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Value</span>
                        <span className="font-bold text-slate-900 dark:text-white">₹{(d.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {!d.isGroup && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Today</span>
                                <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Total P&L</span>
                                <span className={`font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
                                </span>
                            </div>
                        </>
                    )}
                    {d.isGroup && (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Avg Change</span>
                            <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
        )
    }
    return null
}

type HeatmapItem = {
    ticker: string
    name: string
    currentValue: number
    dayChangePercent: number
    pnlPercent: number
    dayPnlRupees: number
    assetType: string
    [key: string]: any
}

export default function PortfolioHeatmap({ data }: { data: HeatmapItem[] }) {
    // Detect which non-stock asset classes exist
    const assetClasses = useMemo(() => {
        const classes = new Set<string>()
        data.forEach(d => {
            if (d.assetType && d.assetType !== 'Stocks') classes.add(d.assetType)
        })
        return Array.from(classes)
    }, [data])

    const hasNonStocks = assetClasses.length > 0

    // Toggle states: which classes to expand individually
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
    const [stocksOnly, setStocksOnly] = useState(false)

    const toggleExpand = (cls: string) => {
        setExpandedClasses(prev => {
            const next = new Set(prev)
            if (next.has(cls)) next.delete(cls)
            else next.add(cls)
            return next
        })
    }

    // Build tree data with grouping logic
    const treeData = useMemo(() => {
        if (!data || data.length === 0) return []

        if (stocksOnly) {
            // Show only stocks
            return data
                .filter(d => d.assetType === 'Stocks')
                .map(d => ({
                    name: d.ticker?.split('.')[0] || d.name,
                    size: Math.max(d.currentValue, 1),
                    value: d.currentValue,
                    dayChangePercent: d.dayChangePercent || 0,
                    pnlPercent: d.pnlPercent || 0,
                    isGroup: false,
                }))
        }

        const items: any[] = []

        // Group non-stock assets by class
        const grouped: Record<string, HeatmapItem[]> = {}

        data.forEach(d => {
            const cls = d.assetType || 'Stocks'

            if (cls === 'Stocks') {
                // Stocks always show individually
                items.push({
                    name: d.ticker?.split('.')[0] || d.name,
                    size: Math.max(d.currentValue, 1),
                    value: d.currentValue,
                    dayChangePercent: d.dayChangePercent || 0,
                    pnlPercent: d.pnlPercent || 0,
                    isGroup: false,
                })
            } else {
                if (!grouped[cls]) grouped[cls] = []
                grouped[cls].push(d)
            }
        })

        // Process grouped classes
        Object.entries(grouped).forEach(([cls, assets]) => {
            if (expandedClasses.has(cls)) {
                // Expanded: show individual items
                assets.forEach(d => {
                    items.push({
                        name: d.ticker?.split('.')[0] || d.name,
                        size: Math.max(d.currentValue, 1),
                        value: d.currentValue,
                        dayChangePercent: d.dayChangePercent || 0,
                        pnlPercent: d.pnlPercent || 0,
                        isGroup: false,
                    })
                })
            } else {
                // Collapsed: show as single block
                const totalValue = assets.reduce((s, a) => s + a.currentValue, 0)
                const avgChange = assets.length > 0
                    ? assets.reduce((s, a) => s + (a.dayChangePercent || 0), 0) / assets.length
                    : 0

                items.push({
                    name: cls,
                    size: Math.max(totalValue, 1),
                    value: totalValue,
                    dayChangePercent: avgChange,
                    pnlPercent: 0,
                    isGroup: true,
                    count: assets.length,
                })
            }
        })

        return items
    }, [data, expandedClasses, stocksOnly])

    if (!data || data.length === 0) return <div className="text-center text-xs text-slate-400 mt-10">No holdings to display</div>

    return (
        <div>
            {/* Filter Controls */}
            {hasNonStocks && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {/* Stocks Only Toggle */}
                    <button
                        onClick={() => { setStocksOnly(!stocksOnly); setExpandedClasses(new Set()) }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${stocksOnly
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                            }`}
                    >
                        <Filter className="h-3 w-3" />
                        Stocks Only
                    </button>

                    {/* Per-class expand toggles */}
                    {!stocksOnly && assetClasses.map(cls => (
                        <button
                            key={cls}
                            onClick={() => toggleExpand(cls)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${expandedClasses.has(cls)
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                }`}
                        >
                            <div className={`h-3 w-3 rounded border flex items-center justify-center ${expandedClasses.has(cls)
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                {expandedClasses.has(cls) && <Check className="h-2 w-2 text-white" />}
                            </div>
                            Show {cls}
                        </button>
                    ))}
                </div>
            )}

            {/* Heatmap */}
            <div style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="transparent"
                        content={<CustomizedContent />}
                        isAnimationActive={false}
                    >
                        <Tooltip content={<CustomTooltip />} cursor={false} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    )
}