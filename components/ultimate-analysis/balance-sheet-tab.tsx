'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

type Props = {
    balanceSheet: any[]
    cashFlow: any[]
}

const fmtNum = (n: number) => {
    if (n === undefined || n === null) return '—'
    return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

// Custom tooltip for D/E chart
function DETooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const de = d.de
    const status = de < 0.5 ? 'Low Leverage' : de < 1.0 ? 'Moderate' : de < 1.5 ? 'High' : 'Very High'
    const statusColor = de < 0.5 ? '#22c55e' : de < 1.0 ? '#f59e0b' : '#ef4444'
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl">
            <p className="text-xs font-semibold text-slate-800 dark:text-white mb-1">{d.period}</p>
            <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: statusColor }}>{de.toFixed(3)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: statusColor + '20', color: statusColor }}>{status}</span>
            </div>
            {d.borrowings !== undefined && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-0.5">
                    <p className="text-[10px] text-slate-500">Borrowings: <span className="font-medium text-slate-700 dark:text-slate-300">₹{fmtNum(d.borrowings)} Cr</span></p>
                    <p className="text-[10px] text-slate-500">Equity+Reserves: <span className="font-medium text-slate-700 dark:text-slate-300">₹{fmtNum(d.equity + d.reserves)} Cr</span></p>
                </div>
            )}
        </div>
    )
}

const getBarColor = (de: number) => de < 0.5 ? '#22c55e' : de < 1.0 ? '#eab308' : de < 1.5 ? '#f97316' : '#ef4444'

export default function BalanceSheetTab({ balanceSheet, cashFlow }: Props) {
    const hasBS = balanceSheet?.length > 0
    const hasCF = cashFlow?.length > 0

    if (!hasBS && !hasCF) return <p className="text-sm text-slate-400 py-8 text-center">No balance sheet data available</p>

    // Show newest first in tables
    const sortedBS = [...(balanceSheet || [])].reverse()
    const sortedCF = [...(cashFlow || [])].reverse()

    // Compute D/E with extra data for tooltip (keep chronological for chart)
    const deData = balanceSheet.map(b => ({
        period: b.period,
        shortLabel: b.period.replace('Mar ', "'").replace('Sep ', "S'").replace('Dec ', "D'").replace('Jun ', "J'"),
        de: b.equity && b.reserves && b.borrowings
            ? +(b.borrowings / (b.equity + b.reserves)).toFixed(4)
            : 0,
        borrowings: b.borrowings || 0,
        equity: b.equity || 0,
        reserves: b.reserves || 0,
    })).filter(d => d.de >= 0)

    return (
        <div className="space-y-6">
            {/* D/E Trend Chart — Interactive Recharts */}
            {deData.length > 1 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Debt / Equity Trend</h4>
                        <div className="flex gap-3 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{'<0.5'}</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />0.5-1.0</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{'>1.0'}</span>
                        </div>
                    </div>
                    <div className="w-full" style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={deData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-200, #e2e8f0)" opacity={0.5} />
                                <XAxis
                                    dataKey="shortLabel"
                                    tick={{ fontSize: 11, fill: 'var(--color-slate-400, #94a3b8)' }}
                                    axisLine={{ stroke: 'var(--color-slate-200, #e2e8f0)' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'var(--color-slate-400, #94a3b8)' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v: number) => v.toFixed(2)}
                                    width={40}
                                />
                                <Tooltip content={<DETooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                                <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'D/E = 1', position: 'right', fontSize: 10, fill: '#ef4444' }} />
                                <Bar dataKey="de" radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out">
                                    {deData.map((entry, index) => (
                                        <Cell key={index} fill={getBarColor(entry.de)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
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
                                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
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
                                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
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
