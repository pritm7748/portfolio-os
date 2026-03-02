'use client'

import { useState, useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from 'recharts'
import { TrendingUp, Pause, ArrowUpRight } from 'lucide-react'

type Props = {
    currentNetWorth: number
    monthlySip: number
    years: number
    expectedReturn: number
}

const fmtINR = (n: number) => {
    const abs = Math.abs(n)
    if (abs >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`
    if (abs >= 100000) return `${(n / 100000).toFixed(2)} L`
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function SipStepupSimulator({ currentNetWorth, monthlySip, years, expectedReturn }: Props) {
    const [stepUpPercent, setStepUpPercent] = useState(10)
    const [pauseMonths, setPauseMonths] = useState(0)
    const [pauseStart, setPauseStart] = useState(12) // month number when pause starts

    const { chartData, flatFinal, stepUpFinal, pauseFinal, stepUpDiff, pauseCost } = useMemo(() => {
        const monthlyRate = expectedReturn / 100 / 12
        const totalMonths = years * 12
        const data: any[] = []

        let flatWealth = currentNetWorth
        let stepUpWealth = currentNetWorth
        let pauseWealth = currentNetWorth
        let currentSipFlat = monthlySip
        let currentSipStepUp = monthlySip
        let flatInvested = currentNetWorth
        let stepUpInvested = currentNetWorth

        for (let m = 1; m <= totalMonths; m++) {
            // Step-up: increase SIP at the start of each year
            if (m > 1 && (m - 1) % 12 === 0) {
                currentSipStepUp = currentSipStepUp * (1 + stepUpPercent / 100)
            }

            // Check if this month is in the pause window
            const isPaused = m >= pauseStart && m < pauseStart + pauseMonths

            // Flat SIP
            flatWealth = (flatWealth + currentSipFlat) * (1 + monthlyRate)
            flatInvested += currentSipFlat

            // Step-up SIP
            stepUpWealth = (stepUpWealth + currentSipStepUp) * (1 + monthlyRate)
            stepUpInvested += currentSipStepUp

            // Pause simulation (uses flat SIP, but pauses for N months)
            const pauseSip = isPaused ? 0 : monthlySip
            pauseWealth = (pauseWealth + pauseSip) * (1 + monthlyRate)

            // Record data points every 6 months
            if (m % 6 === 0) {
                data.push({
                    month: m <= 12 ? `${m}mo` : `${(m / 12).toFixed(1)}yr`,
                    flat: Math.round(flatWealth),
                    stepUp: Math.round(stepUpWealth),
                    ...(pauseMonths > 0 ? { paused: Math.round(pauseWealth) } : {}),
                })
            }
        }

        return {
            chartData: data,
            flatFinal: flatWealth,
            stepUpFinal: stepUpWealth,
            pauseFinal: pauseWealth,
            stepUpDiff: stepUpWealth - flatWealth,
            pauseCost: flatWealth - pauseWealth,
        }
    }, [currentNetWorth, monthlySip, years, expectedReturn, stepUpPercent, pauseMonths, pauseStart])

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Step-up % */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Annual Step-up
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range" min={0} max={30} step={1}
                            value={stepUpPercent}
                            onChange={e => setStepUpPercent(Number(e.target.value))}
                            className="flex-1 accent-indigo-600"
                        />
                        <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 w-14 text-right">{stepUpPercent}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Increase SIP by {stepUpPercent}% each year</p>
                </div>

                {/* Pause Duration */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        SIP Pause Duration
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range" min={0} max={24} step={1}
                            value={pauseMonths}
                            onChange={e => setPauseMonths(Number(e.target.value))}
                            className="flex-1 accent-red-500"
                        />
                        <span className="text-lg font-bold text-red-500 w-14 text-right">{pauseMonths}mo</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Simulate pausing SIP for {pauseMonths} months</p>
                </div>

                {/* Pause Start */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Pause Starting Month
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range" min={1} max={Math.max(years * 12 - 6, 1)} step={1}
                            value={pauseStart}
                            onChange={e => setPauseStart(Number(e.target.value))}
                            className="flex-1 accent-amber-500"
                            disabled={pauseMonths === 0}
                        />
                        <span className={`text-lg font-bold w-14 text-right ${pauseMonths > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                            {pauseStart <= 12 ? `${pauseStart}mo` : `Y${Math.ceil(pauseStart / 12)}`}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{pauseMonths > 0 ? `Pause starts at month ${pauseStart}` : 'Set pause duration first'}</p>
                </div>
            </div>

            {/* Result Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-4">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Flat SIP</p>
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-200 mt-1">₹{fmtINR(flatFinal)}</p>
                    <p className="text-[10px] text-slate-400">₹{monthlySip.toLocaleString('en-IN')}/mo × {years} yrs</p>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-950 border border-indigo-200 dark:border-indigo-900 p-4">
                    <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> With {stepUpPercent}% Step-up
                    </p>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">₹{fmtINR(stepUpFinal)}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold">
                        +₹{fmtINR(stepUpDiff)} more ({((stepUpDiff / flatFinal) * 100).toFixed(0)}% extra)
                    </p>
                </div>

                {pauseMonths > 0 && (
                    <div className="rounded-xl bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-slate-950 border border-red-200 dark:border-red-900 p-4">
                        <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1">
                            <Pause className="h-3 w-3" /> {pauseMonths}mo Pause Impact
                        </p>
                        <p className="text-xl font-bold text-red-500 mt-1">-₹{fmtINR(pauseCost)}</p>
                        <p className="text-[10px] text-red-400">
                            Lost {((pauseCost / flatFinal) * 100).toFixed(1)}% of projected wealth
                        </p>
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="w-full h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradFlat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradStepUp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.4} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                            <YAxis
                                axisLine={false} tickLine={false}
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickFormatter={v => `₹${fmtINR(v)}`}
                                width={70}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                formatter={(value: number, name: string) => [`₹${fmtINR(value)}`, name === 'flat' ? 'Flat SIP' : name === 'stepUp' ? 'Step-up SIP' : 'With Pause']}
                            />
                            <Legend
                                verticalAlign="top" height={36}
                                formatter={(value: string) => value === 'flat' ? 'Flat SIP' : value === 'stepUp' ? `Step-up (${stepUpPercent}% YoY)` : `With ${pauseMonths}mo Pause`}
                            />
                            <Area type="monotone" dataKey="flat" stroke="#94a3b8" fill="url(#gradFlat)" strokeWidth={2} />
                            <Area type="monotone" dataKey="stepUp" stroke="#6366f1" fill="url(#gradStepUp)" strokeWidth={2.5} />
                            {pauseMonths > 0 && (
                                <Line type="monotone" dataKey="paused" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
