'use client'

import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

export default function DashboardSparkline({ data, color }: { data: any[], color?: string }) {
    const { strokeColor, gradientId } = useMemo(() => {
        if (!data || data.length < 2) return { strokeColor: '#94a3b8', gradientId: 'sparkGrey' }
        const start = data[0].value
        const end = data[data.length - 1].value
        const isUp = end >= start
        return {
            strokeColor: isUp ? '#22c55e' : '#ef4444',
            gradientId: isUp ? 'sparkGreen' : 'sparkRed'
        }
    }, [data])

    if (!data || data.length === 0) {
        return <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">No data</div>
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <defs>
                    <linearGradient id="sparkGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="sparkRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={strokeColor}
                    strokeWidth={1.5}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}