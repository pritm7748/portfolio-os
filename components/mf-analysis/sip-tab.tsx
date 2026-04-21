'use client'

import { useState } from 'react'
import { Calculator, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

type Props = { data: any }

const fmtInr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function SipTab({ data }: Props) {
    const defaultSip = data.sip
    const schemeCode = data.meta?.schemeCode

    const [amount, setAmount] = useState(5000)
    const [startYear, setStartYear] = useState(new Date().getFullYear() - 5)
    const [endYear, setEndYear] = useState(new Date().getFullYear())
    const [customResult, setCustomResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const sip = customResult || defaultSip
    if (!sip) return <p className="text-center text-sm text-slate-400 py-20">No SIP data available (NAV history not found)</p>

    const runCustomSip = async () => {
        if (!schemeCode) return
        setLoading(true)
        try {
            const res = await fetch('/api/mf-analysis/sip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schemeCode, monthlyAmount: amount, startYear, endYear }),
            })
            const json = await res.json()
            if (!json.error) setCustomResult(json)
        } catch { }
        setLoading(false)
    }

    const wealth = (sip.currentValue || 0) - (sip.totalInvested || 0)
    const isProfit = wealth >= 0

    return (
        <div className="space-y-6">
            {/* SIP Input Controls */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/50">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-emerald-600" />
                    SIP Calculator
                </h3>
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">Monthly Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(+e.target.value)}
                                className="pl-7 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">From Year</label>
                        <input
                            type="number"
                            value={startYear}
                            onChange={e => setStartYear(+e.target.value)}
                            min={2010} max={endYear - 1}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">To Year</label>
                        <input
                            type="number"
                            value={endYear}
                            onChange={e => setEndYear(+e.target.value)}
                            min={startYear + 1}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>
                    <button
                        onClick={runCustomSip}
                        disabled={loading || !schemeCode}
                        className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                        Calculate
                    </button>
                </div>
            </div>

            {/* Results Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Invested</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{fmtInr(sip.totalInvested || 0)}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Current Value</p>
                    <p className={`text-lg font-bold mt-1 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {fmtInr(sip.currentValue || 0)}
                    </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Wealth Created</p>
                    <p className={`text-lg font-bold mt-1 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {isProfit ? '+' : ''}{fmtInr(wealth)}
                    </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Approx CAGR</p>
                    <p className={`text-lg font-bold mt-1 ${(sip.approxCagr || sip.xirr || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {(sip.approxCagr || sip.xirr || 0).toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* SIP vs Investment Chart */}
            {sip.chartData?.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Investment vs Value Over Time</h3>
                    <div className="h-[300px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sip.chartData}>
                                <defs>
                                    <linearGradient id="sipValueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="sipInvGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }} formatter={(v: number) => [fmtInr(v)]} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                <Area type="monotone" dataKey="invested" name="Invested" stroke="#6366f1" strokeWidth={1.5} fill="url(#sipInvGrad)" />
                                <Area type="monotone" dataKey="value" name="Value" stroke="#10b981" strokeWidth={2} fill="url(#sipValueGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Lumpsum Comparison */}
            {sip.lumpsum && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">SIP vs Lumpsum</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                                </div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-white">SIP</span>
                            </div>
                            <p className="text-xs text-slate-500">Invested: {fmtInr(sip.totalInvested)}</p>
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmtInr(sip.currentValue)}</p>
                            <p className="text-xs font-semibold mt-1 text-emerald-600">
                                {sip.absoluteReturn || ((sip.currentValue - sip.totalInvested) / sip.totalInvested * 100).toFixed(1)}% return
                            </p>
                        </div>
                        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <ArrowRight className="h-4 w-4 text-indigo-600" />
                                </div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-white">Lumpsum</span>
                            </div>
                            <p className="text-xs text-slate-500">Invested: {fmtInr(sip.lumpsum.invested)}</p>
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">{fmtInr(sip.lumpsum.value)}</p>
                            <p className={`text-xs font-semibold mt-1 ${sip.lumpsum.return >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                                {sip.lumpsum.return}% return
                            </p>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        {sip.currentValue > sip.lumpsum.value
                            ? '✅ SIP performed better — rupee cost averaging helped in volatile markets.'
                            : '📊 Lumpsum performed better — the market trended upward during this period.'}
                    </p>
                </div>
            )}
        </div>
    )
}
