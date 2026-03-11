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
    const reversed = [...data].reverse()
    const maxDE = Math.max(...reversed.map(d => d.de), 1)
    const barW = 100 / reversed.length
    return (
        <div>
            <p className="text-xs text-slate-500 mb-2">Debt/Equity Trend</p>
            <svg viewBox="0 0 200 60" className="w-full h-16">
                {reversed.map((d, i) => {
                    const h = (d.de / maxDE) * 50
                    const color = d.de < 0.5 ? '#22c55e' : d.de < 1.5 ? '#f59e0b' : '#ef4444'
                    return (
                        <g key={i}>
                            <rect x={i * barW * 2 + barW * 0.3} y={55 - h} width={barW * 1.4} height={h} rx="2" fill={color} opacity="0.8" />
                            <text x={i * barW * 2 + barW} y="58" textAnchor="middle" className="text-[5px] fill-slate-400">{d.period}</text>
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

    // Compute D/E
    const deData = balanceSheet.map(b => ({
        period: b.period,
        de: b.equity && b.reserves && b.borrowings
            ? b.borrowings / (b.equity + b.reserves || 1)
            : 0
    })).filter(d => d.de >= 0)

    return (
        <div className="space-y-6">
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
                                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Total Assets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {balanceSheet.map((b, i) => (
                                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">{b.period}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(b.equity)}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(b.reserves)}</td>
                                        <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtNum(b.borrowings)}</td>
                                        <td className="px-4 py-2.5 text-right font-medium text-slate-800 dark:text-white">{fmtNum(b.totalAssets)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* D/E Trend */}
            {deData.length > 1 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <DETrendChart data={deData} />
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
                                {cashFlow.map((c, i) => (
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
