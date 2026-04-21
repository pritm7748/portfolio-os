'use client'

import { TrendingUp, TrendingDown, IndianRupee, Percent, Shield, User, Calendar, DollarSign, Info } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Props = { data: any }

const fmt = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(0)} Cr`
    if (n >= 100000) return `₹${(n / 100000).toFixed(0)} L`
    return `₹${n.toLocaleString('en-IN')}`
}

const returnBadge = (val: number | null, label: string) => {
    if (val === null || val === undefined) return null
    const isPositive = val >= 0
    return (
        <div className="flex flex-col items-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 min-w-[80px]">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
            <span className={`text-base font-bold mt-1 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{val.toFixed(1)}%
            </span>
        </div>
    )
}

const RISK_COLORS: Record<string, string> = {
    'Low': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Moderately Low': 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
    'Moderate': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Moderately High': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'High': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Very High': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
}

export default function OverviewTab({ data }: Props) {
    const { meta, nav, returns, navChart, risk } = data
    const trailing = returns?.trailing || {}

    return (
        <div className="space-y-6">
            {/* Fund Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/50">
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{meta?.fundName}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {meta?.category && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {meta.category}
                            </span>
                        )}
                        {meta?.riskRating && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${RISK_COLORS[meta.riskRating] || RISK_COLORS['Moderate']}`}>
                                <Shield className="h-3 w-3 inline mr-1" />{meta.riskRating}
                            </span>
                        )}
                        {meta?.fundHouse && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{meta.fundHouse}</span>
                        )}
                    </div>
                </div>
                {nav && (
                    <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{nav.current?.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">NAV · {nav.date}</p>
                    </div>
                )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'AUM', value: meta?.aum ? fmt(meta.aum) : 'N/A', icon: IndianRupee, color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Expense Ratio', value: meta?.expenseRatio != null ? `${meta.expenseRatio}%` : 'N/A', icon: Percent, color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Min SIP', value: meta?.minSip ? `₹${meta.minSip}` : 'N/A', icon: Calendar, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Min Lumpsum', value: meta?.minLumpsum ? `₹${meta.minLumpsum.toLocaleString('en-IN')}` : 'N/A', icon: DollarSign, color: 'text-purple-600 dark:text-purple-400' },
                ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                            <m.icon className={`h-4 w-4 ${m.color}`} />
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{m.label}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{m.value}</p>
                    </div>
                ))}
            </div>

            {/* Return Snapshot */}
            <div>
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Returns</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {returnBadge(trailing['1M'], '1M')}
                    {returnBadge(trailing['3M'], '3M')}
                    {returnBadge(trailing['6M'], '6M')}
                    {returnBadge(trailing['YTD'], 'YTD')}
                    {returnBadge(trailing['1Y'], '1Y')}
                    {returnBadge(trailing['3Y'], '3Y')}
                    {returnBadge(trailing['5Y'], '5Y')}
                    {returnBadge(trailing['SI'], 'SI')}
                </div>
            </div>

            {/* NAV Chart */}
            {navChart && navChart.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">NAV History (5Y)</h3>
                    <div className="h-[280px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={navChart}>
                                <defs>
                                    <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                                    formatter={(value: number) => [`₹${value.toFixed(2)}`, 'NAV']}
                                />
                                <Area type="monotone" dataKey="nav" stroke="#10b981" strokeWidth={2} fill="url(#navGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Fund Manager + Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meta?.fundManager && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-indigo-500" />
                            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Fund Manager</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                            {typeof meta.fundManager === 'string' ? meta.fundManager : JSON.stringify(meta.fundManager)}
                        </p>
                    </div>
                )}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 space-y-2">
                    {meta?.benchmark && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Benchmark</span>
                            <span className="font-medium text-slate-800 dark:text-white">{meta.benchmark}</span>
                        </div>
                    )}
                    {meta?.exitLoad && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Exit Load</span>
                            <span className="font-medium text-slate-800 dark:text-white text-right max-w-[200px] truncate">{meta.exitLoad}</span>
                        </div>
                    )}
                    {meta?.launchDate && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Inception</span>
                            <span className="font-medium text-slate-800 dark:text-white">{meta.launchDate}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Risk Summary */}
            {risk && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Std Dev (1Y)', value: `${risk.stdDev1Y}%`, good: risk.stdDev1Y < 15 },
                        { label: 'Sharpe Ratio', value: risk.sharpe?.toFixed(2), good: risk.sharpe > 1 },
                        { label: 'Max Drawdown', value: `-${risk.maxDrawdown}%`, good: risk.maxDrawdown < 20 },
                    ].map(r => (
                        <div key={r.label} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{r.label}</p>
                            <p className={`text-lg font-bold mt-1 ${r.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {r.value}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
