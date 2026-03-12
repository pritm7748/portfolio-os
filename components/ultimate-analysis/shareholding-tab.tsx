'use client'

type Props = {
    shareholding: any[]
    holdersBreakdown: { insidersPercentHeld: number; institutionsPercentHeld: number }
    insiderActivity: { name: string; relation: string; date: string; type: string; shares: number; value: number }[]
}

const fmtPct = (n: number) => n ? n.toFixed(2) + '%' : '—'

// Stacked bar chart for shareholding trend
function ShareholdingChart({ data }: { data: any[] }) {
    if (data.length < 2) return null
    // Show latest on the right
    const displayData = [...data].slice(-8) // Show last 8 quarters max
    const barW = Math.min(40, 240 / displayData.length)
    const chartH = 60
    const colors = { promoters: '#6366f1', fii: '#f59e0b', dii: '#10b981', retail: '#94a3b8' }

    return (
        <div>
            <div className="flex gap-4 mb-3 text-[10px]">
                {Object.entries(colors).map(([k, c]) => (
                    <span key={k} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                        <span className="text-slate-500 dark:text-slate-400 capitalize">{k === 'fii' ? 'FII' : k === 'dii' ? 'DII' : k === 'retail' ? 'Public' : k}</span>
                    </span>
                ))}
            </div>
            <svg viewBox={`0 0 ${displayData.length * barW + 10} ${chartH + 14}`} className="w-full h-28">
                {displayData.map((d, i) => {
                    const x = i * barW + 5
                    const w = barW * 0.75
                    // Stack bars from bottom up
                    const segs = [
                        { val: d.promoters || 0, color: colors.promoters },
                        { val: d.fii || 0, color: colors.fii },
                        { val: d.dii || 0, color: colors.dii },
                        { val: d.retail || 0, color: colors.retail },
                    ]
                    let cumY = chartH // Start from bottom
                    return (
                        <g key={i}>
                            {segs.map((s, j) => {
                                const h = (s.val / 100) * chartH
                                cumY -= h
                                return <rect key={j} x={x} y={cumY} width={w} height={h} fill={s.color} rx="1.5" opacity="0.9" />
                            })}
                            <text x={x + w / 2} y={chartH + 10} textAnchor="middle" className="text-[3.5px] fill-slate-400 dark:fill-slate-500">
                                {d.period?.replace(/\s+/g, ' ')}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

export default function ShareholdingTab({ shareholding, holdersBreakdown, insiderActivity }: Props) {
    // Show newest first in table
    const sortedShareholding = [...(shareholding || [])].reverse()

    return (
        <div className="space-y-6">
            {/* Shareholding Trend */}
            {shareholding?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Shareholding Pattern (Quarterly)</h4>
                    <ShareholdingChart data={shareholding} />

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
                                {sortedShareholding.map((s, i) => (
                                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                        <td className="px-3 py-2 text-slate-800 dark:text-white font-medium">{s.period}</td>
                                        <td className="px-3 py-2 text-right text-indigo-600 dark:text-indigo-400 font-medium">{fmtPct(s.promoters)}</td>
                                        <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{fmtPct(s.fii)}</td>
                                        <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{fmtPct(s.dii)}</td>
                                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{fmtPct(s.retail)}</td>
                                    </tr>
                                ))}
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
