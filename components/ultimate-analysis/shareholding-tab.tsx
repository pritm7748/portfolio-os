'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Props = {
    shareholding: any[]
    holdersBreakdown: { insidersPercentHeld: number; institutionsPercentHeld: number }
    insiderActivity: { name: string; relation: string; date: string; type: string; shares: number; value: number }[]
}

const fmtPct = (n: number) => n ? n.toFixed(2) + '%' : '—'

const COLORS = {
    promoters: '#6366f1',
    fii: '#f59e0b',
    dii: '#10b981',
    retail: '#94a3b8',
}

// Custom tooltip for shareholding chart
function SHTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    if (!d) return null
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl min-w-[160px]">
            <p className="text-xs font-semibold text-slate-800 dark:text-white mb-2 pb-1 border-b border-slate-100 dark:border-slate-700">{d.period}</p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.promoters }} />Promoters</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{fmtPct(d.promoters)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.fii }} />FII</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{fmtPct(d.fii)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.dii }} />DII</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtPct(d.dii)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.retail }} />Public</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">{fmtPct(d.retail)}</span>
                </div>
            </div>
        </div>
    )
}

export default function ShareholdingTab({ shareholding, holdersBreakdown, insiderActivity }: Props) {
    // Show newest first in table
    const sortedShareholding = [...(shareholding || [])].reverse()

    // Chart data (chronological, last 8 quarters)
    const chartData = (shareholding || []).slice(-8).map(d => ({
        ...d,
        shortLabel: d.period?.replace('Mar ', "'").replace('Sep ', "S'").replace('Dec ', "D'").replace('Jun ', "J'"),
    }))

    return (
        <div className="space-y-6">
            {/* Shareholding Trend */}
            {shareholding?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">Shareholding Pattern (Quarterly)</h4>

                    {/* Interactive Recharts Stacked Bar */}
                    <div className="w-full" style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-slate-200, #e2e8f0)" opacity={0.4} />
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
                                    tickFormatter={(v: number) => v + '%'}
                                    domain={[0, 100]}
                                    width={40}
                                />
                                <Tooltip content={<SHTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                                <Legend
                                    verticalAlign="top"
                                    height={30}
                                    iconType="square"
                                    iconSize={10}
                                    formatter={(value: string) => (
                                        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                            {value === 'fii' ? 'FII' : value === 'dii' ? 'DII' : value === 'retail' ? 'Public' : value}
                                        </span>
                                    )}
                                />
                                <Bar dataKey="promoters" stackId="a" fill={COLORS.promoters} radius={[0, 0, 0, 0]} animationDuration={800} />
                                <Bar dataKey="fii" stackId="a" fill={COLORS.fii} animationDuration={800} animationBegin={100} />
                                <Bar dataKey="dii" stackId="a" fill={COLORS.dii} animationDuration={800} animationBegin={200} />
                                <Bar dataKey="retail" stackId="a" fill={COLORS.retail} radius={[4, 4, 0, 0]} animationDuration={800} animationBegin={300} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Data table */}
                    <div className="overflow-x-auto mt-4">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="text-left px-3 py-2 text-xs text-slate-500">Period</th>
                                    <th className="text-right px-3 py-2 text-xs text-slate-500">Promoters</th>
                                    <th className="text-right px-3 py-2 text-xs text-slate-500">FII</th>
                                    <th className="text-right px-3 py-2 text-xs text-slate-500">DII</th>
                                    <th className="text-right px-3 py-2 text-xs text-slate-500">Public</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedShareholding.map((s, i) => {
                                    // Show change vs previous quarter
                                    const prev = sortedShareholding[i + 1]
                                    const fiiChange = prev ? s.fii - prev.fii : 0
                                    const diiChange = prev ? s.dii - prev.dii : 0
                                    return (
                                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                            <td className="px-3 py-2 text-slate-800 dark:text-white font-medium">{s.period}</td>
                                            <td className="px-3 py-2 text-right text-indigo-600 dark:text-indigo-400 font-medium">{fmtPct(s.promoters)}</td>
                                            <td className="px-3 py-2 text-right">
                                                <span className="text-amber-600 dark:text-amber-400">{fmtPct(s.fii)}</span>
                                                {fiiChange !== 0 && (
                                                    <span className={`ml-1 text-[10px] ${fiiChange > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {fiiChange > 0 ? '▲' : '▼'}{Math.abs(fiiChange).toFixed(1)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className="text-emerald-600 dark:text-emerald-400">{fmtPct(s.dii)}</span>
                                                {diiChange !== 0 && (
                                                    <span className={`ml-1 text-[10px] ${diiChange > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {diiChange > 0 ? '▲' : '▼'}{Math.abs(diiChange).toFixed(1)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{fmtPct(s.retail)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Holders Breakdown (Yahoo) */}
            {(holdersBreakdown.insidersPercentHeld > 0 || holdersBreakdown.institutionsPercentHeld > 0) && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Ownership Summary</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/10 p-4 text-center">
                            <p className="text-xs text-slate-500 mb-1">Insiders</p>
                            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{fmtPct(holdersBreakdown.insidersPercentHeld)}</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 p-4 text-center">
                            <p className="text-xs text-slate-500 mb-1">Institutions</p>
                            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmtPct(holdersBreakdown.institutionsPercentHeld)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Insider Transactions */}
            {insiderActivity?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Recent Insider Activity</h4>
                    <div className="space-y-2">
                        {insiderActivity.map((t, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                <div>
                                    <p className="text-sm font-medium text-slate-800 dark:text-white">{t.name}</p>
                                    <p className="text-[10px] text-slate-500">{t.relation} · {t.date}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-semibold ${t.type?.toLowerCase().includes('purchase') || t.type?.toLowerCase().includes('buy') ? 'text-green-600' : 'text-red-500'}`}>
                                        {t.type}
                                    </p>
                                    <p className="text-[10px] text-slate-500">{t.shares?.toLocaleString()} shares</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!shareholding?.length && !insiderActivity?.length && (
                <p className="text-sm text-slate-400 py-8 text-center">No shareholding data available</p>
            )}
        </div>
    )
}
