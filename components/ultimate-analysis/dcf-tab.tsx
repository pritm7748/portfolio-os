'use client'

import { useState } from 'react'

type Props = {
    valuation: any
    cashFlow: any[]
    recommendationTrend: any[]
    upgrades: { date: string; firm: string; toGrade: string; fromGrade: string; action: string }[]
}

const fmtCr = (n: number) => {
    if (!n) return '—'
    const abs = Math.abs(n)
    if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr'
    if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L'
    return '₹' + n.toLocaleString('en-IN')
}

export default function DcfTab({ valuation, cashFlow, recommendationTrend, upgrades }: Props) {
    // DCF inputs — get LATEST year cash flow (last entry, not first!)
    // Screener values are in Cr (₹), multiply by 1e7 to convert to absolute ₹ for DCF math
    // Use operating cash flow if FCF is negative/zero (more conservative)
    const latestCF = cashFlow?.length > 0 ? cashFlow[cashFlow.length - 1] : null
    const fcfFromScreener = latestCF
        ? (latestCF.freeCashFlow > 0 ? latestCF.freeCashFlow : latestCF.operatingCF || 0)
        : 0
    const latestFCF = valuation?.freeCashFlow > 0
        ? valuation.freeCashFlow                    // Yahoo (already absolute ₹)
        : fcfFromScreener * 1e7                     // Screener Cr → absolute ₹
    const latestFCFDisplay = valuation?.freeCashFlow > 0
        ? valuation.freeCashFlow
        : fcfFromScreener * 1e7
    const [growthRate, setGrowthRate] = useState(12)
    const [discountRate, setDiscountRate] = useState(11)
    const [terminalGrowth, setTerminalGrowth] = useState(3)
    const [projectionYears] = useState(10)

    // DCF Calculation
    let totalPV = 0
    let fcf = latestFCF
    for (let i = 1; i <= projectionYears; i++) {
        fcf *= (1 + growthRate / 100)
        totalPV += fcf / Math.pow(1 + discountRate / 100, i)
    }
    const terminalValue = (fcf * (1 + terminalGrowth / 100)) / ((discountRate - terminalGrowth) / 100)
    const pvTerminal = terminalValue / Math.pow(1 + discountRate / 100, projectionYears)
    const enterpriseValue = totalPV + pvTerminal
    const netDebt = (valuation?.totalDebt || 0) - (valuation?.totalCash || 0)
    const equityValue = enterpriseValue - netDebt
    const mcap = valuation?.marketCap || 1
    const intrinsicVsMcap = mcap > 0 ? ((equityValue - mcap) / mcap) * 100 : 0
    const currentPrice = valuation?.currentPrice || 0
    const intrinsicPerShare = mcap > 0 && currentPrice > 0 ? (equityValue / mcap) * currentPrice : 0
    const marginOfSafety = intrinsicPerShare > 0 ? ((intrinsicPerShare - currentPrice) / intrinsicPerShare) * 100 : 0

    // Recommendation distribution
    const latestRec = recommendationTrend?.[0] || {}
    const recTotal = (latestRec.strongBuy || 0) + (latestRec.buy || 0) + (latestRec.hold || 0) + (latestRec.sell || 0) + (latestRec.strongSell || 0)

    return (
        <div className="space-y-6">
            {/* DCF Calculator */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">DCF Calculator</h4>

                {latestFCF <= 0 ? (
                    <p className="text-sm text-slate-400 italic">DCF requires positive free cash flow. This company has negative/zero FCF.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                            <div>
                                <label className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>Growth Rate</span><span className="font-bold text-indigo-600">{growthRate}%</span>
                                </label>
                                <input type="range" min="1" max="30" value={growthRate}
                                    onChange={e => setGrowthRate(Number(e.target.value))}
                                    className="w-full accent-indigo-600" />
                            </div>
                            <div>
                                <label className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>Discount Rate (WACC)</span><span className="font-bold text-indigo-600">{discountRate}%</span>
                                </label>
                                <input type="range" min="8" max="18" step="0.5" value={discountRate}
                                    onChange={e => setDiscountRate(Number(e.target.value))}
                                    className="w-full accent-indigo-600" />
                            </div>
                            <div>
                                <label className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>Terminal Growth</span><span className="font-bold text-indigo-600">{terminalGrowth}%</span>
                                </label>
                                <input type="range" min="1" max="5" step="0.5" value={terminalGrowth}
                                    onChange={e => setTerminalGrowth(Number(e.target.value))}
                                    className="w-full accent-indigo-600" />
                            </div>
                        </div>

                        {/* Result */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                                <p className="text-[10px] text-slate-500 mb-1">Latest FCF</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">{fmtCr(latestFCF)}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                                <p className="text-[10px] text-slate-500 mb-1">Enterprise Value</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">{fmtCr(enterpriseValue)}</p>
                            </div>
                            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/10 p-3 text-center">
                                <p className="text-[10px] text-slate-500 mb-1">Intrinsic Value / Share</p>
                                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">₹{intrinsicPerShare.toFixed(0)}</p>
                            </div>
                            <div className={`rounded-lg p-3 text-center ${marginOfSafety > 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                                <p className="text-[10px] text-slate-500 mb-1">Margin of Safety</p>
                                <p className={`text-lg font-bold ${marginOfSafety > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                    {marginOfSafety.toFixed(1)}%
                                </p>
                                <p className="text-[10px] text-slate-500">CMP: ₹{currentPrice.toLocaleString('en-IN')}</p>
                            </div>
                        </div>

                        {/* Visual Gauge */}
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Overvalued</span>
                                <span>Current Price</span>
                                <span>Undervalued</span>
                            </div>
                            <div className="relative w-full bg-gradient-to-r from-red-400 via-amber-400 to-green-400 rounded-full h-3">
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-slate-800 rounded-full shadow-lg"
                                    style={{ left: `${Math.min(Math.max(50 + marginOfSafety / 2, 2), 98)}%` }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Analyst Recommendation */}
            {recTotal > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Analyst Consensus</h4>
                    <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                        {[
                            { val: latestRec.strongBuy, color: 'bg-green-600', label: 'Strong Buy' },
                            { val: latestRec.buy, color: 'bg-green-400', label: 'Buy' },
                            { val: latestRec.hold, color: 'bg-amber-400', label: 'Hold' },
                            { val: latestRec.sell, color: 'bg-red-400', label: 'Sell' },
                            { val: latestRec.strongSell, color: 'bg-red-600', label: 'Strong Sell' },
                        ].filter(s => s.val > 0).map(s => (
                            <div key={s.label} className={`${s.color} flex items-center justify-center text-white text-[10px] font-bold`}
                                style={{ width: `${(s.val / recTotal) * 100}%` }} title={`${s.label}: ${s.val}`}>
                                {s.val}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                        <span>Strong Buy</span><span>Hold</span><span>Strong Sell</span>
                    </div>
                </div>
            )}

            {/* Upgrade/Downgrade History */}
            {upgrades?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Upgrade/Downgrade History</h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {upgrades.map((u, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                <div>
                                    <p className="text-xs font-medium text-slate-800 dark:text-white">{u.firm}</p>
                                    <p className="text-[10px] text-slate-500">{u.date}</p>
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                    {u.fromGrade && <span className="text-slate-500">{u.fromGrade}</span>}
                                    {u.fromGrade && <span className="text-slate-400">→</span>}
                                    <span className={`font-semibold ${
                                        u.action === 'up' ? 'text-green-600' :
                                        u.action === 'down' ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
                                    }`}>{u.toGrade}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
