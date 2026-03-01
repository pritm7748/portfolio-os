'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

type HoldingPnl = { ticker: string, pnlPercent: number }

type Props = {
    data: HoldingPnl[]
}

export default function PnlDistributionChart({ data }: Props) {
    if (!data || data.length === 0) return <div className="text-center text-xs text-slate-400 mt-10">No data available</div>

    // Define Buckets
    const buckets = [
        { name: '< -20%', min: -Infinity, max: -20, count: 0, color: '#dc2626' },
        { name: '-20 to -10%', min: -20, max: -10, count: 0, color: '#f87171' },
        { name: '-10 to 0%', min: -10, max: 0, count: 0, color: '#fca5a5' },
        { name: '0 to +10%', min: 0, max: 10, count: 0, color: '#86efac' },
        { name: '+10 to +20%', min: 10, max: 20, count: 0, color: '#4ade80' },
        { name: '+20 to +50%', min: 20, max: 50, count: 0, color: '#22c55e' },
        { name: '> +50%', min: 50, max: Infinity, count: 0, color: '#16a34a' },
    ]

    data.forEach(h => {
        const p = h.pnlPercent
        if (p < -20) buckets[0].count++
        else if (p < -10) buckets[1].count++
        else if (p < 0) buckets[2].count++
        else if (p <= 10) buckets[3].count++
        else if (p <= 20) buckets[4].count++
        else if (p <= 50) buckets[5].count++
        else buckets[6].count++
    })

    const winners = data.filter(h => h.pnlPercent > 0).length
    const losers = data.filter(h => h.pnlPercent < 0).length
    const flat = data.length - winners - losers
    const avgReturn = data.reduce((s, h) => s + h.pnlPercent, 0) / data.length

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-900 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl text-xs z-50">
                    <span className="font-bold text-slate-800 dark:text-white">{payload[0].payload.name}</span>
                    <span className="block mt-0.5 text-slate-500 dark:text-slate-400">{payload[0].value} {payload[0].value === 1 ? 'stock' : 'stocks'}</span>
                </div>
            )
        }
        return null
    }

    return (
        <div className="flex flex-col h-full">
            {/* Summary Bar */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-green-600 dark:text-green-400 font-semibold">▲ {winners} winners</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-red-500 dark:text-red-400 font-semibold">▼ {losers} losers</span>
                    {flat > 0 && <><span className="text-slate-400">·</span><span className="text-slate-500">{flat} flat</span></>}
                </div>
                <span className={`text-[11px] font-bold ${avgReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    Avg: {avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(1)}%
                </span>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {buckets.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}