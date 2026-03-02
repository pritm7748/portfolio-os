'use client'

import { useState, useMemo } from 'react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { SlidersHorizontal, Check, MoreVertical, Map } from 'lucide-react'

// ── Types ──
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

// ── Group styling ──
const GROUP_STYLE: Record<string, { bg: string; label: string; emoji: string }> = {
    'Mutual Funds': { bg: '#6366f1', label: 'MFs', emoji: '📊' },
    'Commodities': { bg: '#d97706', label: 'Commodities', emoji: '🪙' },
    'Currencies': { bg: '#0891b2', label: 'Forex', emoji: '💱' },
}

// ── Color scale ──
const getColor = (change: number) => {
    if (change >= 4) return '#15803d'
    if (change >= 2) return '#16a34a'
    if (change >= 0.5) return '#22c55e'
    if (change > 0) return '#4ade80'
    if (change === 0) return '#64748b'
    if (change > -0.5) return '#f87171'
    if (change > -2) return '#ef4444'
    if (change > -4) return '#dc2626'
    return '#b91c1c'
}

// ── Treemap cell ──
const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, dayChangePercent, isGroup, count, groupLabel, groupEmoji } = props
    const change = dayChangePercent || 0
    if (!name || width < 2 || height < 2) return null

    const fill = isGroup ? (GROUP_STYLE[name]?.bg || '#64748b') : getColor(change)
    const showTicker = width > 35 && height > 24
    const showChange = width > 45 && height > 38
    const showValue = width > 60 && height > 52

    return (
        <g>
            <rect x={x} y={y} width={width} height={height} fill={fill}
                stroke="var(--bg-background, #ffffff)" strokeWidth={2}
                className="transition-opacity hover:opacity-80 cursor-pointer dark:stroke-slate-900" rx={4} />
            {isGroup && <rect x={x} y={y} width={width} height={height} fill="rgba(255,255,255,0.06)" rx={4} />}
            {showTicker && (
                <text x={x + width / 2} y={y + height / 2 - (showChange ? 8 : 0)}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#fff" fontSize={isGroup ? 13 : 11} fontWeight="bold"
                    className="pointer-events-none drop-shadow-sm">
                    {isGroup ? `${groupEmoji || ''} ${groupLabel || name}` : name}
                </text>
            )}
            {showChange && (
                <text x={x + width / 2} y={y + height / 2 + (showValue ? 8 : 10)}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#fff" fontSize={10} fontWeight="500" opacity={0.92}
                    className="pointer-events-none">
                    {isGroup ? `${count} holding${count === 1 ? '' : 's'}` : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
                </text>
            )}
            {isGroup && showValue && (
                <text x={x + width / 2} y={y + height / 2 + 22}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#fff" fontSize={9} fontWeight="500" opacity={0.7}
                    className="pointer-events-none">
                    ₹{(props.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </text>
            )}
        </g>
    )
}

// ── Tooltip ──
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload
        const change = d.dayChangePercent || 0
        const pnl = d.pnlPercent || 0
        return (
            <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-xs z-50 min-w-[170px]">
                <p className="font-bold text-slate-800 dark:text-white mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                    {d.isGroup && <span>{d.groupEmoji}</span>}
                    <span>{d.isGroup ? d.name : (d.fullName || d.name)}</span>
                    {d.isGroup && <span className="text-[10px] font-medium text-slate-400">({d.count})</span>}
                </p>
                <div className="space-y-1.5">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Value</span>
                        <span className="font-bold text-slate-900 dark:text-white">₹{(d.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {!d.isGroup ? (
                        <>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Today</span>
                                <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Total P&L</span>
                                <span className={`font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Avg Change</span>
                            <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
                        </div>
                    )}
                </div>
            </div>
        )
    }
    return null
}

// ════════════════════════════════════════════════════════════
//  SELF-CONTAINED HEATMAP SECTION
//  Renders its own header (with filters) + chart body.
//  Drop-in replacement for <Section> + <PortfolioHeatmap>.
// ════════════════════════════════════════════════════════════
export default function PortfolioHeatmap({ data }: { data: HeatmapItem[] }) {
    const assetClasses = useMemo(() => {
        const classes = new Set<string>()
        data.forEach(d => { if (d.assetType && d.assetType !== 'Stocks') classes.add(d.assetType) })
        return Array.from(classes)
    }, [data])

    const hasNonStocks = assetClasses.length > 0
    const [stocksOnly, setStocksOnly] = useState(false)
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
    const [overflowOpen, setOverflowOpen] = useState(false)

    const toggleStocksOnly = () => { setStocksOnly(v => !v); setExpandedClasses(new Set()); setOverflowOpen(false) }
    const toggleExpand = (cls: string) => {
        setExpandedClasses(prev => {
            const next = new Set(prev)
            next.has(cls) ? next.delete(cls) : next.add(cls)
            return next
        })
    }

    const treeData = useMemo(() => {
        if (!data || data.length === 0) return []

        if (stocksOnly) {
            return data.filter(d => d.assetType === 'Stocks').map(d => ({
                name: d.ticker?.split('.')[0] || d.name, fullName: d.ticker,
                size: Math.max(d.currentValue, 1), value: d.currentValue,
                dayChangePercent: d.dayChangePercent || 0, pnlPercent: d.pnlPercent || 0, isGroup: false,
            }))
        }

        const items: any[] = []
        const grouped: Record<string, HeatmapItem[]> = {}

        data.forEach(d => {
            const cls = d.assetType || 'Stocks'
            if (cls === 'Stocks') {
                items.push({
                    name: d.ticker?.split('.')[0] || d.name, fullName: d.ticker,
                    size: Math.max(d.currentValue, 1), value: d.currentValue,
                    dayChangePercent: d.dayChangePercent || 0, pnlPercent: d.pnlPercent || 0, isGroup: false,
                })
            } else {
                if (!grouped[cls]) grouped[cls] = []
                grouped[cls].push(d)
            }
        })

        Object.entries(grouped).forEach(([cls, assets]) => {
            if (expandedClasses.has(cls)) {
                assets.forEach(d => items.push({
                    name: d.ticker?.split('.')[0] || d.name, fullName: d.ticker,
                    size: Math.max(d.currentValue, 1), value: d.currentValue,
                    dayChangePercent: d.dayChangePercent || 0, pnlPercent: d.pnlPercent || 0, isGroup: false,
                }))
            } else {
                const totalValue = assets.reduce((s, a) => s + a.currentValue, 0)
                const avgChange = assets.length > 0 ? assets.reduce((s, a) => s + (a.dayChangePercent || 0), 0) / assets.length : 0
                const style = GROUP_STYLE[cls] || { bg: '#64748b', label: cls, emoji: '📁' }
                items.push({
                    name: cls, groupLabel: style.label, groupEmoji: style.emoji,
                    size: Math.max(totalValue, 1), value: totalValue,
                    dayChangePercent: avgChange, pnlPercent: 0, isGroup: true, count: assets.length,
                })
            }
        })
        return items
    }, [data, expandedClasses, stocksOnly])

    if (!data || data.length === 0) return <div className="text-center text-xs text-slate-400 mt-10">No holdings to display</div>

    // Overflow logic: show up to 2 inline, rest in "..." menu
    const MAX_INLINE = 2
    const inlineClasses = assetClasses.slice(0, MAX_INLINE)
    const overflowClasses = assetClasses.slice(MAX_INLINE)

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
            {/* ── Header with filters ── */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Map className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex-shrink-0">Portfolio Heatmap</h3>

                {hasNonStocks && (
                    <div className="ml-auto flex items-center gap-1.5">
                        {/* Stocks Only */}
                        <button onClick={toggleStocksOnly}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition-all whitespace-nowrap ${stocksOnly
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                }`}>
                            <SlidersHorizontal className="h-2.5 w-2.5" />
                            Stocks Only
                        </button>

                        {/* Inline expand toggles */}
                        {!stocksOnly && inlineClasses.map(cls => {
                            const style = GROUP_STYLE[cls]
                            const isExpanded = expandedClasses.has(cls)
                            return (
                                <button key={cls} onClick={() => toggleExpand(cls)}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition-all whitespace-nowrap ${isExpanded
                                            ? 'bg-slate-800 border-slate-700 text-white dark:bg-slate-200 dark:border-slate-200 dark:text-slate-900'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                        }`}>
                                    <span className="text-[9px] leading-none">{style?.emoji}</span>
                                    {style?.label || cls}
                                </button>
                            )
                        })}

                        {/* Overflow "..." menu */}
                        {!stocksOnly && overflowClasses.length > 0 && (
                            <div className="relative">
                                <button onClick={() => setOverflowOpen(!overflowOpen)}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:text-slate-300 transition-all">
                                    <MoreVertical className="h-3 w-3" />
                                </button>
                                {overflowOpen && (
                                    <div className="absolute right-0 top-8 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1.5 flex flex-col gap-1 min-w-[130px]">
                                        {overflowClasses.map(cls => {
                                            const style = GROUP_STYLE[cls]
                                            const isExpanded = expandedClasses.has(cls)
                                            return (
                                                <button key={cls} onClick={() => { toggleExpand(cls); setOverflowOpen(false) }}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all w-full text-left ${isExpanded
                                                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                                                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                                        }`}>
                                                    <span>{style?.emoji}</span>
                                                    <span>{style?.label || cls}</span>
                                                    {isExpanded && <Check className="h-3 w-3 ml-auto text-indigo-600" />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Chart body ── */}
            <div className="p-5">
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap data={treeData} dataKey="size" aspectRatio={4 / 3}
                            stroke="transparent" content={<CustomizedContent />} isAnimationActive={false}>
                            <Tooltip content={<CustomTooltip />} cursor={false} />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}