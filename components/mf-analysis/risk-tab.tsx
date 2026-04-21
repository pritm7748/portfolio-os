'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'

type Props = { data: any }

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function heatColor(val: number): string {
    if (val >= 5) return 'bg-emerald-600 text-white'
    if (val >= 2) return 'bg-emerald-400 text-white'
    if (val >= 0) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
    if (val >= -2) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    if (val >= -5) return 'bg-red-400 text-white'
    return 'bg-red-600 text-white'
}

export default function RiskTab({ data }: Props) {
    const risk = data.risk || {}
    const heatmap = data.heatmap || []
    const drawdown = data.drawdownSeries || []

    // Group heatmap by year
    const years = [...new Set(heatmap.map((h: any) => h.year))].sort() as number[]

    const metrics = [
        { label: 'Std Dev (1Y)', value: `${risk.stdDev1Y}%`, desc: 'Annualized volatility over last 12 months', good: risk.stdDev1Y < 15 },
        { label: 'Std Dev (3Y)', value: `${risk.stdDev3Y}%`, desc: 'Annualized volatility over last 3 years', good: risk.stdDev3Y < 18 },
        { label: 'Sharpe Ratio', value: risk.sharpe?.toFixed(2), desc: 'Risk-adjusted return (higher is better)', good: risk.sharpe > 1 },
        { label: 'Sortino Ratio', value: risk.sortino?.toFixed(2), desc: 'Downside risk-adjusted return', good: risk.sortino > 1.5 },
        { label: 'Max Drawdown', value: `-${risk.maxDrawdown}%`, desc: `${risk.maxDrawdownPeriod?.from || ''} → ${risk.maxDrawdownPeriod?.to || ''}`, good: risk.maxDrawdown < 20 },
    ]

    return (
        <div className="space-y-6">
            {/* Risk Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {metrics.map(m => (
                    <div key={m.label} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{m.label}</p>
                        <p className={`text-xl font-bold mt-1 ${m.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {m.value}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">{m.desc}</p>
                    </div>
                ))}
            </div>

            {/* Best / Worst Day */}
            {(risk.bestDay || risk.worstDay) && (
                <div className="grid grid-cols-2 gap-3">
                    {risk.bestDay && (
                        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">Best Single Day</p>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">+{risk.bestDay.return}%</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{risk.bestDay.date}</p>
                        </div>
                    )}
                    {risk.worstDay && (
                        <div className="p-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20">
                            <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Worst Single Day</p>
                            <p className="text-xl font-bold text-red-500 mt-1">{risk.worstDay.return}%</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{risk.worstDay.date}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Drawdown Chart */}
            {drawdown.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Drawdown Chart (5Y)</h3>
                    <div className="h-[220px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={drawdown}>
                                <defs>
                                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={['auto', 0]} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Drawdown']} />
                                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={0.5} />
                                <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#ddGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        Drawdown shows how much the fund fell from its peak. Shallower and shorter drawdowns indicate better risk management.
                    </p>
                </div>
            )}

            {/* Monthly Return Heatmap */}
            {years.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Monthly Return Heatmap</h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/80">
                                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Year</th>
                                    {MONTH_NAMES.map(m => (
                                        <th key={m} className="px-1.5 py-2 text-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{m}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {years.map(yr => (
                                    <tr key={yr} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300">{yr}</td>
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const entry = heatmap.find((h: any) => h.year === yr && h.month === i + 1)
                                            return (
                                                <td key={i} className="px-0.5 py-1">
                                                    {entry ? (
                                                        <div className={`rounded px-1 py-0.5 text-center text-[10px] font-semibold ${heatColor(entry.return)}`}>
                                                            {entry.return > 0 ? '+' : ''}{entry.return.toFixed(1)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-300 dark:text-slate-700">—</div>
                                                    )}
                                                </td>
                                            )
                                        })}
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
