'use client'

import { useMemo } from 'react'
import { AlertTriangle, Scale, Trophy, CalendarCheck } from 'lucide-react'
import { calculateXIRR } from '@/lib/xirr'

type Props = {
    transactions: any[]
    priceMap: any
    monthlySip: number
    expectedReturn: number
    currentNetWorth: number
}

const fmtINR = (n: number) => {
    const abs = Math.abs(n)
    if (abs >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`
    if (abs >= 100000) return `${(n / 100000).toFixed(2)} L`
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

const getRoot = (t: string) => t.toUpperCase().replace('.NS', '').replace('.BO', '')

export default function SipInsights({ transactions, priceMap, monthlySip, expectedReturn, currentNetWorth }: Props) {
    const insights = useMemo(() => {
        if (!transactions || transactions.length === 0) return null

        const buyTxns = transactions
            .filter((t: any) => t.transaction_type === 'Buy')
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

        if (buyTxns.length === 0) return null

        // ═══════════════════════════════════════════════════
        //  1. MISSED SIP TRACKER
        // ═══════════════════════════════════════════════════
        const firstBuyDate = new Date(buyTxns[0].date)
        const now = new Date()
        const monthsActive: Set<string> = new Set()

        buyTxns.forEach((t: any) => {
            const d = new Date(t.date)
            monthsActive.add(`${d.getFullYear()}-${d.getMonth()}`)
        })

        // Count total months since first buy
        let totalMonths = 0
        const d = new Date(firstBuyDate.getFullYear(), firstBuyDate.getMonth())
        while (d <= now) {
            totalMonths++
            d.setMonth(d.getMonth() + 1)
        }

        const investedMonths = monthsActive.size
        const missedMonths = Math.max(0, totalMonths - investedMonths)

        // Projected cost of missed months
        const monthlyRate = expectedReturn / 100 / 12
        let missedCost = 0
        // Each missed SIP would have compounded for the remaining duration
        const monthsSinceFirst = totalMonths
        // Simple approximation: average missed SIP compounds for (remaining months / 2)
        missedCost = missedMonths * monthlySip * Math.pow(1 + monthlyRate, monthsSinceFirst / 2) - missedMonths * monthlySip

        // ═══════════════════════════════════════════════════
        //  2. SIP vs LUMPSUM COMPARISON
        // ═══════════════════════════════════════════════════
        const totalInvested = buyTxns.reduce((s: number, t: any) => s + Number(t.quantity) * Number(t.price), 0)
        const monthsSinceStart = Math.max(1, (now.getTime() - firstBuyDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))

        // If the same total was invested as lumpsum on day 1 at the expected return rate
        const lumpsumFV = totalInvested * Math.pow(1 + expectedReturn / 100, monthsSinceStart / 12)
        const sipBetter = currentNetWorth > lumpsumFV

        // ═══════════════════════════════════════════════════
        //  3. SIP XIRR PER HOLDING
        // ═══════════════════════════════════════════════════
        // Group buy/sell transactions by root symbol
        const txnsByRoot: Record<string, { txns: any[], ticker: string }> = {}
        transactions.forEach((t: any) => {
            if (t.transaction_type !== 'Buy' && t.transaction_type !== 'Sell') return
            const root = getRoot(t.assets.ticker)
            if (!txnsByRoot[root]) txnsByRoot[root] = { txns: [], ticker: t.assets.ticker }
            txnsByRoot[root].txns.push(t)
        })

        // Compute holdings qty and current value per root
        const holdingXirr: { ticker: string, name: string, xirr: number, currentValue: number }[] = []

        Object.entries(txnsByRoot).forEach(([root, { txns, ticker }]) => {
            let qty = 0
            const cashFlows: { amount: number, date: string }[] = []

            txns.forEach((t: any) => {
                const amt = Number(t.quantity) * Number(t.price)
                if (t.transaction_type === 'Buy') {
                    qty += Number(t.quantity)
                    cashFlows.push({ amount: -amt, date: t.date })
                } else {
                    qty -= Number(t.quantity)
                    cashFlows.push({ amount: amt, date: t.date })
                }
            })

            if (qty <= 0.0001 || cashFlows.length === 0) return

            // Find current price
            let price = priceMap?.[ticker]?.price
            if (!price) {
                const clean = ticker.toUpperCase().replace(/\s/g, '').split('.')[0]
                const foundKey = Object.keys(priceMap || {}).find(k => k.includes(clean))
                if (foundKey) price = priceMap[foundKey]?.price
            }

            if (!price) return

            const currentValue = qty * price
            const xirr = calculateXIRR(cashFlows, currentValue)

            holdingXirr.push({
                ticker: root,
                name: root,
                xirr,
                currentValue,
            })
        })

        holdingXirr.sort((a, b) => b.xirr - a.xirr)

        // ═══════════════════════════════════════════════════
        //  4. CONSISTENCY SCORE
        // ═══════════════════════════════════════════════════
        const consistencyPercent = totalMonths > 0 ? (investedMonths / totalMonths) * 100 : 0
        const consistencyGrade =
            consistencyPercent >= 90 ? 'Excellent' :
                consistencyPercent >= 75 ? 'Good' :
                    consistencyPercent >= 50 ? 'Average' : 'Needs Work'
        const consistencyColor =
            consistencyPercent >= 90 ? 'text-green-600 dark:text-green-400' :
                consistencyPercent >= 75 ? 'text-blue-600 dark:text-blue-400' :
                    consistencyPercent >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'

        return {
            missedMonths,
            investedMonths,
            totalMonths,
            missedCost,
            totalInvested,
            lumpsumFV,
            sipBetter,
            holdingXirr,
            consistencyPercent,
            consistencyGrade,
            consistencyColor,
        }
    }, [transactions, priceMap, monthlySip, expectedReturn, currentNetWorth])

    if (!insights) {
        return <div className="text-center text-sm text-slate-400 py-8">Need transaction history to generate SIP insights.</div>
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Card 1: Missed SIP Tracker */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Missed SIP Tracker</h4>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">Months with investment</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{insights.investedMonths} / {insights.totalMonths}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">Months missed</span>
                        <span className={`text-sm font-bold ${insights.missedMonths > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                            {insights.missedMonths} {insights.missedMonths === 0 && '🎉'}
                        </span>
                    </div>
                    {insights.missedMonths > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-slate-500">Estimated opportunity cost</span>
                                <span className="text-sm font-bold text-red-500">₹{fmtINR(insights.missedCost)}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                Based on ₹{monthlySip.toLocaleString('en-IN')}/mo at {expectedReturn}% return
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Card 2: SIP vs Lumpsum */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
                        <Scale className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">SIP vs Lumpsum</h4>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">Your SIP portfolio value</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white">₹{fmtINR(currentNetWorth)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">If same ₹{fmtINR(insights.totalInvested)} was lumpsum</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">₹{fmtINR(insights.lumpsumFV)}</span>
                    </div>
                    <div className={`pt-2 border-t border-slate-100 dark:border-slate-800 text-center rounded-lg py-2 ${insights.sipBetter ? 'bg-green-50 dark:bg-green-900/10' : 'bg-amber-50 dark:bg-amber-900/10'}`}>
                        <p className={`text-xs font-bold ${insights.sipBetter ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {insights.sipBetter
                                ? `SIP outperformed by ₹${fmtINR(currentNetWorth - insights.lumpsumFV)}`
                                : `Lumpsum would be ahead by ₹${fmtINR(insights.lumpsumFV - currentNetWorth)}`
                            }
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">At {expectedReturn}% expected return</p>
                    </div>
                </div>
            </div>

            {/* Card 3: SIP XIRR per Holding */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                        <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">XIRR per Holding</h4>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {insights.holdingXirr.length > 0 ? insights.holdingXirr.map((h, i) => (
                        <div key={h.ticker} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-white">{h.name}</span>
                            </div>
                            <div className="text-right">
                                <span className={`text-xs font-bold ${h.xirr >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                    {h.xirr > 0 ? '+' : ''}{h.xirr.toFixed(1)}%
                                </span>
                                <p className="text-[9px] text-slate-400">₹{fmtINR(h.currentValue)}</p>
                            </div>
                        </div>
                    )) : (
                        <p className="text-xs text-slate-400">No active holdings to compute XIRR</p>
                    )}
                </div>
            </div>

            {/* Card 4: Consistency Score */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                        <CalendarCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">SIP Consistency</h4>
                </div>

                <div className="text-center py-3">
                    <p className={`text-4xl font-bold ${insights.consistencyColor}`}>
                        {insights.consistencyPercent.toFixed(0)}%
                    </p>
                    <p className={`text-sm font-semibold mt-1 ${insights.consistencyColor}`}>
                        {insights.consistencyGrade}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2">
                        Invested in {insights.investedMonths} out of {insights.totalMonths} months since you started
                    </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mt-3 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${insights.consistencyPercent >= 90 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                                insights.consistencyPercent >= 75 ? 'bg-gradient-to-r from-blue-500 to-indigo-400' :
                                    insights.consistencyPercent >= 50 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                        'bg-gradient-to-r from-red-500 to-orange-400'
                            }`}
                        style={{ width: `${Math.min(insights.consistencyPercent, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    )
}
