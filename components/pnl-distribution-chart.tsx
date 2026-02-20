'use client'

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

type Props = {
    data: { ticker: string, pnlPercent: number }[]
}

export default function PnlDistributionChart({ data }: Props) {
    if (!data || data.length === 0) return <div className="text-center text-xs text-slate-400 mt-10">No data available</div>

    // Define Buckets
    const buckets = [
        { name: '< -20%', count: 0, color: '#ef4444' }, // Red 500
        { name: '-20% to -10%', count: 0, color: '#f87171' }, // Red 400
        { name: '-10% to 0%', count: 0, color: '#fca5a5' }, // Red 300
        { name: '0% to +10%', count: 0, color: '#86efac' }, // Green 300
        { name: '+10% to +20%', count: 0, color: '#4ade80' }, // Green 400
        { name: '+20% to +50%', count: 0, color: '#22c55e' }, // Green 500
        { name: '> +50%', count: 0, color: '#16a34a' }, // Green 600
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

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl text-xs z-50">
                    <span className="font-bold text-slate-800 dark:text-white">{payload[0].payload.name}</span>
                    <span className="block mt-1 text-slate-600 dark:text-slate-400">{payload[0].value} Assets</span>
                </div>
            )
        }
        return null
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                {/* Zero Line Separator */}
                <ReferenceLine x="-10% to 0%" stroke="#e2e8f0" strokeDasharray="3 3" />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {buckets.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}