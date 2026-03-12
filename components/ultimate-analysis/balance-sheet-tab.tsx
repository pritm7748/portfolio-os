'use client'

type Props = {
    balanceSheet: any[]
    cashFlow: any[]
}

const fmtNum = (n: number) => {
    if (n === undefined || n === null) return '—'
    return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

// SVG bar chart for D/E trend
function DETrendChart({ data }: { data: { period: string; de: number }[] }) {
    if (data.length < 2) return null
    // Show oldest→newest (left→right), limit to last 8
    const displayData = data.slice(-8)
    const maxDE = Math.max(...displayData.map(d => d.de), 0.01) // Avoid division by zero
    const chartW = 240
    const chartH = 60
    const barGap = chartW / displayData.length
    const barW = barGap * 0.65

    return (
        <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Debt/Equity Trend</p>
            <svg viewBox={`0 0 ${chartW} ${chartH + 16}`} className="w-full h-24">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
                    const val = maxDE * frac
                    const y = chartH - (frac * chartH)
                    return (
                        <g key={i}>
                            <line x1="0" y1={y} x2={chartW} y2={y} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2,2" />
                            <text x="-2" y={y + 2} textAnchor="end" className="text-[4px] fill-slate-400">{val.toFixed(2)}</text>
                        </g>
                    )
                })}
                {displayData.map((d, i) => {
                    const h = Math.max((d.de / maxDE) * chartH, 1.5) // Minimum visible height
                    const x = i * barGap + (barGap - barW) / 2
                    const color = d.de < 0.5 ? '#22c55e' : d.de < 1.5 ? '#f59e0b' : '#ef4444'
                    // Extract short year label like "17", "18"
                    const label = d.period.replace(/\s+/g, '\n')
                    return (
                        <g key={i}>
                            <rect x={x} y={chartH - h} width={barW} height={h} rx="2" fill={color} opacity="0.85" />
                            {/* Value on top of bar */}
                            <text x={x + barW / 2} y={chartH - h - 2} textAnchor="middle" className="text-[4px] fill-slate-600 dark:fill-slate-300 font-medium">
                                {d.de.toFixed(2)}
                            </text>
                            {/* Period label */}
                            <text x={x + barW / 2} y={chartH + 8} textAnchor="middle" className="text-[4px] fill-slate-400">
                                {d.period.replace('Mar ', "'").replace('Sep ', "Sep'")}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

export default function BalanceSheetTab({ balanceSheet, cashFlow }: Props) {
    const hasBS = balanceSheet?.length > 0
    const hasCF = cashFlow?.length > 0

    if (!hasBS && !hasCF) return <p className="text-sm text-slate-400 py-8 text-center">No balance sheet data available</p>

    // Show newest first in tables
    const sortedBS = [...(balanceSheet || [])].reverse()
    const sortedCF = [...(cashFlow || [])].reverse()

    // Compute D/E (keep chronological for chart)
    const deData = balanceSheet.map(b => ({
        period: b.period,
        de: b.equity && b.reserves && b.borrowings
            ? b.borrowings / (b.equity + b.reserves || 1)
            : 0
    })).filter(d => d.de >= 0)

    return (
        <div className="space-y-6">
            {/* D/E Trend — Show chart FIRST for visual impact */}
            {deData.length > 1 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <DETrendChart data={deData} />
                </div>
            )}

            {/* Balance Sheet Table */}
            {hasBS && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Balance Sheet (₹ Cr)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="text-left px-4 py-2.5 text-xs text-slate-500">Period</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Equity</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Reserves</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Borrowings</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">D/E</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Total Assets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBS.map((b, i) => {
                                    const de = b.equity && b.reserves && b.borrowings
                                        ? (b.borrowings / (b.equity + b.reserves)).toFixed(2)
                                        : '—'
                                    return (
                                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">{b.period}</td>
                                            <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(b.equity)}</td>
                                            <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(b.reserves)}</td>
                                            <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(b.borrowings)}</td>
                                            <td className={`px-4 py-2.5 text-right font-medium ${
                                                parseFloat(de) < 0.5 ? 'text-green-600 dark:text-green-400' :
                                                parseFloat(de) < 1.5 ? 'text-amber-600' : 'text-red-500'
                                            }`}>{de}</td>
                                            <td className="px-4 py-2.5 text-right font-medium text-slate-800 dark:text-white">{fmtNum(b.totalAssets)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Cash Flow Table */}
            {hasCF && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Cash Flow Statement (₹ Cr)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="text-left px-4 py-2.5 text-xs text-slate-500">Period</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Operating</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Investing</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Financing</th>
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Free CF</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCF.map((c, i) => (
                                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">{c.period}</td>
                                        <td className={`px-4 py-2.5 text-right ${(c.operatingCF || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{fmtNum(c.operatingCF)}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(c.investingCF)}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(c.financingCF)}</td>
                                        <td className={`px-4 py-2.5 text-right font-medium ${(c.freeCashFlow || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{fmtNum(c.freeCashFlow)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
