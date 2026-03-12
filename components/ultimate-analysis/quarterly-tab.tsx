'use client'

type Props = {
    quarters: any[]
    earningsHistory: { period: string; actual: number; estimate: number }[]
}

const fmtNum = (n: number) => {
    if (n === undefined || n === null) return '—'
    return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

function yoyGrowth(current: number, arr: any[], idx: number, key: string): string {
    // Compare with same quarter last year (4 quarters back)
    const prevIdx = idx + 4
    if (prevIdx >= arr.length || !arr[prevIdx]?.[key]) return '—'
    const prev = arr[prevIdx][key]
    if (prev === 0) return '—'
    const pct = ((current - prev) / Math.abs(prev)) * 100
    return pct.toFixed(1) + '%'
}

function qoqGrowth(current: number, arr: any[], idx: number, key: string): string {
    const prevIdx = idx + 1
    if (prevIdx >= arr.length || !arr[prevIdx]?.[key]) return '—'
    const prev = arr[prevIdx][key]
    if (prev === 0) return '—'
    const pct = ((current - prev) / Math.abs(prev)) * 100
    return pct.toFixed(1) + '%'
}

function GrowthBadge({ value }: { value: string }) {
    if (value === '—') return <span className="text-slate-400 text-[10px]">—</span>
    const n = parseFloat(value)
    return (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            n > 0 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20' :
            n < 0 ? 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20' :
            'text-slate-500 bg-slate-100 dark:bg-slate-800'
        }`}>
            {n > 0 ? '↑' : '↓'} {value}
        </span>
    )
}

// Simple inline sparkline using SVG
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
    if (values.length < 2) return null
    const reversed = [...values].reverse()
    const max = Math.max(...reversed)
    const min = Math.min(...reversed)
    const range = max - min || 1
    const w = 100
    const h = 28
    const points = reversed.map((v, i) => `${(i / (reversed.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-7">
            <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        </svg>
    )
}

export default function QuarterlyTab({ quarters, earningsHistory }: Props) {
    if (!quarters?.length) return <p className="text-sm text-slate-400 py-8 text-center">No quarterly data available</p>

    // Show newest first
    const sortedQuarters = [...quarters].reverse()
    const revenueVals = sortedQuarters.map(q => q.revenue || 0)
    const profitVals = sortedQuarters.map(q => q.netProfit || 0)

    return (
        <div className="space-y-6">
            {/* Sparkline Overview */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <p className="text-xs text-slate-500 mb-1">Revenue Trend</p>
                    <MiniSparkline values={revenueVals} color="#6366f1" />
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <p className="text-xs text-slate-500 mb-1">Net Profit Trend</p>
                    <MiniSparkline values={profitVals} color="#10b981" />
                </div>
            </div>

            {/* Quarterly Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Period</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Revenue (Cr)</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">OPM%</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Net Profit (Cr)</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">EPS</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">YoY Rev</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">QoQ Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedQuarters.map((q, i) => (
                                <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white whitespace-nowrap">{q.period}</td>
                                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{fmtNum(q.revenue)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={q.opm > 15 ? 'text-green-600 dark:text-green-400' : q.opm > 5 ? 'text-amber-600' : 'text-red-500'}>
                                            {q.opm !== undefined ? q.opm.toFixed(1) + '%' : '—'}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium ${(q.netProfit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                        {fmtNum(q.netProfit)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{q.eps !== undefined ? q.eps.toFixed(2) : '—'}</td>
                                    <td className="px-4 py-3 text-right"><GrowthBadge value={yoyGrowth(q.revenue, sortedQuarters, i, 'revenue')} /></td>
                                    <td className="px-4 py-3 text-right"><GrowthBadge value={qoqGrowth(q.netProfit, sortedQuarters, i, 'netProfit')} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Earnings Surprise */}
            {earningsHistory?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Earnings Surprise (EPS)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {earningsHistory.map((e, i) => {
                            const surprise = e.estimate ? ((e.actual - e.estimate) / Math.abs(e.estimate)) * 100 : 0
                            return (
                                <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3 text-center">
                                    <p className="text-[10px] text-slate-500 mb-1">{e.period}</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">₹{e.actual?.toFixed(2)}</p>
                                    <p className="text-[10px] text-slate-500">Est: ₹{e.estimate?.toFixed(2)}</p>
                                    {surprise !== 0 && (
                                        <span className={`text-[10px] font-semibold ${surprise > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {surprise > 0 ? '▲' : '▼'} {surprise.toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
