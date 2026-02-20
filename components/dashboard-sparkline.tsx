'use client'

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

export default function DashboardSparkline({ data, color }: { data: any[], color: string }) {
    if (!data || data.length === 0) return null

    // Determine if overall trend is positive or negative
    const start = data[0].value
    const end = data[data.length - 1].value
    const isUp = end >= start

    const strokeColor = isUp ? '#22c55e' : '#ef4444' // Force Green/Red

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={strokeColor} 
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false}
                />
            </LineChart>
        </ResponsiveContainer>
    )
}