'use client'

import { useState, useEffect } from 'react'
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'

type InsightsStructure = {
    kpis: { name: string; unit: string }[]
    periods: string[]
}

type InsightRow = {
    name: string
    unit: string
    values: { period: string; value: number | null }[]
}

type Props = {
    ticker: string
    companyName: string
    insightsStructure: InsightsStructure
}

// Mini sparkline component using SVG
function Sparkline({ values }: { values: (number | null)[] }) {
    const nums = values.filter((v): v is number => v !== null)
    if (nums.length < 2) return null

    const min = Math.min(...nums)
    const max = Math.max(...nums)
    const range = max - min || 1
    const w = 80
    const h = 24
    const pad = 2

    const points = nums.map((v, i) => {
        const x = pad + (i / (nums.length - 1)) * (w - pad * 2)
        const y = h - pad - ((v - min) / range) * (h - pad * 2)
        return `${x},${y}`
    }).join(' ')

    const trend = nums[nums.length - 1] - nums[0]
    const color = trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#94a3b8'

    return (
        <svg width={w} height={h} className="inline-block">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            {nums.length > 0 && (() => {
                const lastX = pad + ((nums.length - 1) / (nums.length - 1)) * (w - pad * 2)
                const lastY = h - pad - ((nums[nums.length - 1] - min) / range) * (h - pad * 2)
                return <circle cx={lastX} cy={lastY} r={2} fill={color} />
            })()}
        </svg>
    )
}

function TrendBadge({ values }: { values: (number | null)[] }) {
    const nums = values.filter((v): v is number => v !== null)
    if (nums.length < 2) return null

    const first = nums[0]
    const last = nums[nums.length - 1]
    if (first === 0) return null

    const change = ((last - first) / Math.abs(first)) * 100
    const isUp = change > 0
    const isFlat = Math.abs(change) < 1

    if (isFlat) {
        return (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                <Minus className="h-2.5 w-2.5" /> Flat
            </span>
        )
    }

    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${isUp
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            }`}>
            {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {isUp ? '+' : ''}{change.toFixed(1)}%
        </span>
    )
}

function formatValue(val: number | null, unit: string) {
    if (val === null || val === undefined) return '—'
    if (unit === '%') return val.toFixed(2)
    if (Number.isInteger(val) && val > 999) return val.toLocaleString('en-IN')
    if (val > 0 && val < 100) return val.toFixed(2)
    return val.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function InsightsTab({ ticker, companyName, insightsStructure }: Props) {
    const [insights, setInsights] = useState<InsightRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [cached, setCached] = useState(false)

    const hasStructure = insightsStructure?.kpis?.length > 0

    const fetchInsights = async (forceRefresh = false) => {
        if (!hasStructure) return

        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/stock-insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker,
                    companyName,
                    kpis: insightsStructure.kpis,
                    periods: insightsStructure.periods,
                    forceRefresh,
                })
            })
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}))
                throw new Error(errBody.error || 'Failed to fetch insights')
            }
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            setInsights(json.insights || [])
            setCached(json.cached || false)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchInsights()
    }, [ticker])

    if (!hasStructure) {
        return (
            <div className="text-center py-16">
                <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No company-specific insights available for this stock</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                        Company-Specific KPIs
                    </h4>
                    {cached && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-400">cached</span>
                    )}
                </div>
                {!loading && insights.length > 0 && (
                    <button
                        onClick={() => fetchInsights(true)}
                        className="text-xs text-slate-400 hover:text-indigo-500 transition flex items-center gap-1"
                    >
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        AI is researching operational KPIs from public sources...
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                        Analyzing annual reports & investor presentations
                    </p>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30 p-6 text-center">
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                    <button onClick={() => fetchInsights()} className="mt-2 text-xs text-indigo-600 hover:underline">Try again</button>
                </div>
            )}

            {/* Insights Table */}
            {insights.length > 0 && !loading && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-800/50 min-w-[200px]">
                                        Metric
                                    </th>
                                    <th className="text-center px-3 py-3 text-xs text-slate-400 w-[90px]">Trend</th>
                                    {insightsStructure.periods.map(p => (
                                        <th key={p} className="text-right px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                                            {p}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {insights.map((row, idx) => {
                                    const valuesForPeriods = insightsStructure.periods.map(p => {
                                        const match = row.values.find(v => v.period === p)
                                        return match?.value ?? null
                                    })

                                    return (
                                        <tr
                                            key={idx}
                                            className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group"
                                        >
                                            {/* KPI Name */}
                                            <td className="px-4 py-3 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/30 transition">
                                                <div>
                                                    <span className="font-medium text-slate-800 dark:text-white text-sm">{row.name}</span>
                                                    {row.unit && (
                                                        <span className="ml-1.5 text-[10px] text-slate-400 font-normal">{row.unit}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Sparkline + trend badge */}
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Sparkline values={valuesForPeriods} />
                                                    <TrendBadge values={valuesForPeriods} />
                                                </div>
                                            </td>

                                            {/* Values */}
                                            {valuesForPeriods.map((val, i) => (
                                                <td
                                                    key={i}
                                                    className={`px-3 py-3 text-right whitespace-nowrap tabular-nums ${val !== null
                                                            ? 'text-slate-700 dark:text-slate-300'
                                                            : 'text-slate-300 dark:text-slate-600'
                                                        }`}
                                                >
                                                    {formatValue(val, row.unit)}
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Source attribution */}
            {insights.length > 0 && !loading && (
                <p className="text-[10px] text-slate-400 text-center">
                    Data sourced from annual reports & investor presentations via AI analysis. Values may have minor variations.
                </p>
            )}

            {/* KPI names preview while loading */}
            {loading && (
                <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-2">KPIs being researched:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {insightsStructure.kpis.map((k, i) => (
                            <span key={i} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500">
                                {k.name} {k.unit && `(${k.unit})`}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
