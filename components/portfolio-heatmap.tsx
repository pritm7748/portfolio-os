'use client'

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'

// Custom SVG renderer for the Treemap blocks
const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, dayChangePercent } = props

    // FIX: Recharts creates a parent 'root' node that lacks our custom properties.
    // We must safely fallback to 0 or empty strings to prevent undefined crashes.
    const change = dayChangePercent || 0
    const displayName = name ? String(name).split('.')[0] : ''

    // Determine color based on Daily Change Intensity
    let fill = '#94a3b8' // Neutral Grey
    if (change >= 2) fill = '#16a34a' // Strong Green
    else if (change > 0) fill = '#4ade80' // Light Green
    else if (change <= -2) fill = '#dc2626' // Strong Red
    else if (change < 0) fill = '#f87171' // Light Red

    // Don't render text if the box is too tiny
    const showText = width > 45 && height > 35
    const showSubText = width > 55 && height > 50

    // If there is no name (e.g., it's a structural root node), don't render anything
    if (!name) return null

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fill}
                stroke="var(--bg-background, #ffffff)"
                strokeWidth={2}
                className="transition-all hover:opacity-80 cursor-pointer dark:stroke-slate-900"
            />
            {showText && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 - (showSubText ? 4 : -4)}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={12}
                    fontWeight="bold"
                    className="pointer-events-none drop-shadow-md"
                >
                    {displayName}
                </text>
            )}
            {showSubText && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 12}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={10}
                    fontWeight="medium"
                    opacity={0.9}
                    className="pointer-events-none"
                >
                    {change > 0 ? '+' : ''}{change.toFixed(2)}%
                </text>
            )}
        </g>
    )
}

// Custom Tooltip for hovering over blocks
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        // Safe fallback for tooltip as well
        const change = data.dayChangePercent || 0

        return (
            <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-sm z-50 min-w-[150px]">
                <p className="font-bold text-slate-800 dark:text-white mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    {data.name || 'Asset'}
                </p>
                <div className="flex justify-between gap-4 text-xs mb-1">
                    <span className="text-slate-500">Total Value:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                        ₹{(data.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                    <span className="text-slate-500">Day's Move:</span>
                    <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                </div>
            </div>
        )
    }
    return null
}

export default function PortfolioHeatmap({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="text-center text-xs text-slate-400 mt-10">No data available</div>

    // Map holdings into the format Recharts Treemap requires
    const treeData = data.map(d => ({
        name: d.ticker,
        size: Math.max(d.currentValue, 1), // Size dictates block area (cannot be 0)
        value: d.currentValue, // Used for tooltip display
        dayChangePercent: d.dayChangePercent || 0
    }))

    return (
        <ResponsiveContainer width="100%" height="100%">
            <Treemap
                data={treeData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                content={<CustomizedContent />}
                isAnimationActive={false}
            >
                <Tooltip content={<CustomTooltip />} cursor={false} />
            </Treemap>
        </ResponsiveContainer>
    )
}