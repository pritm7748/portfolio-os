'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'

type Props = { data: any }

export default function PerformanceTab({ data }: Props) {
    const trailing = data.returns?.trailing || {}
    const calendarYear = data.returns?.calendarYear || []
    const rolling = data.rollingReturns || {}

    const periods = ['1M', '3M', '6M', 'YTD', '1Y', '2Y', '3Y', '5Y', '10Y', 'SI']

    return (
        <div className="space-y-6">
            {/* Trailing Returns Table */}
            <div>
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Trailing Returns</h3>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="grid grid-cols-5 sm:grid-cols-10 divide-x divide-slate-200 dark:divide-slate-700">
                        {periods.map(p => {
                            const val = trailing[p]
                            return (
                                <div key={p} className="p-3 text-center bg-white dark:bg-slate-800/50">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{p}</p>
                                    {val != null ? (
                                        <p className={`text-sm font-bold mt-1 ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                            {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-300 dark:text-slate-600 mt-1">—</p>
                                    )}
                                    <p className="text-[9px] text-slate-400 mt-0.5">{['1Y', '2Y', '3Y', '5Y', '10Y', 'SI'].includes(p) ? 'CAGR' : 'Abs'}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Calendar Year Returns */}
            {calendarYear.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Calendar Year Returns</h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Year</th>
                                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Return</th>
                                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold w-1/2">Visual</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...calendarYear].reverse().map((y: any) => {
                                    const isPos = y.return >= 0
                                    const barWidth = Math.min(Math.abs(y.return) * 2, 100)
                                    return (
                                        <tr key={y.year} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-white">{y.year}</td>
                                            <td className={`px-4 py-2.5 text-right font-bold ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                                {isPos ? '+' : ''}{y.return.toFixed(1)}%
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1">
                                                    <div className="flex-1 flex justify-end">
                                                        {!isPos && <div className="h-3 rounded-l bg-red-400 dark:bg-red-500/60" style={{ width: `${barWidth}%` }} />}
                                                    </div>
                                                    <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 shrink-0" />
                                                    <div className="flex-1">
                                                        {isPos && <div className="h-3 rounded-r bg-emerald-400 dark:bg-emerald-500/60" style={{ width: `${barWidth}%` }} />}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Rolling Returns Chart */}
            {rolling.series?.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">1-Year Rolling Returns (5Y Window)</h3>
                        <div className="flex gap-3 text-[10px]">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Max: {rolling.max}%</span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">Avg: {rolling.avg?.toFixed(1)}%</span>
                            <span className="text-red-500 font-bold">Min: {rolling.min}%</span>
                        </div>
                    </div>
                    <div className="h-[280px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={rolling.series}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Rolling 1Y']} />
                                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                                <Line type="monotone" dataKey="return" stroke="#10b981" strokeWidth={1.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        A narrow band indicates consistency. The average rolling return shows what you'd likely earn over any 1-year window.
                    </p>
                </div>
            )}
        </div>
    )
}
