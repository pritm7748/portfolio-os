'use client'

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'

// Color scale with more intensity levels
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

const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, dayChangePercent, pnlPercent } = props
    const change = dayChangePercent || 0
    const displayName = name ? String(name).split('.')[0] : ''

    if (!name || width < 2 || height < 2) return null

    const fill = getColor(change)
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
            {showTicker && (
                <text
                    x={x + width / 2} y={y + height / 2 - (showChange ? 6 : 0)}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#ffffff" fontSize={11} fontWeight="bold"
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
                    {change > 0 ? '+' : ''}{change.toFixed(2)}%
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
                </p>
                <div className="space-y-1.5">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Value</span>
                        <span className="font-bold text-slate-900 dark:text-white">₹{(d.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
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
                </div>
            </div>
        )
    }
    return null
}

export default function PortfolioHeatmap({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="text-center text-xs text-slate-400 mt-10">No holdings to display</div>

    const treeData = data.map(d => ({
        name: d.ticker,
        size: Math.max(d.currentValue, 1),
        value: d.currentValue,
        dayChangePercent: d.dayChangePercent || 0,
        pnlPercent: d.pnlPercent || 0,
    }))

    return (
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
    )
}