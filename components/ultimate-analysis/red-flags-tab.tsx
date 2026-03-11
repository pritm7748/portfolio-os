'use client'

import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'

type Props = { data: any }

type FlagResult = { check: string; status: 'ok' | 'watch' | 'danger'; detail: string }

function computeFlags(data: any): FlagResult[] {
    const v = data.valuation || {}
    const q = data.quarters || []
    const cf = data.cashFlow || []
    const flags: FlagResult[] = []

    // 1. Promoter Pledging
    const pledged = v.pledgedPercent || 0
    flags.push({
        check: 'Promoter Pledging',
        status: pledged === 0 ? 'ok' : pledged < 10 ? 'watch' : 'danger',
        detail: pledged === 0 ? 'No shares pledged' : `${pledged.toFixed(1)}% shares pledged`
    })

    // 2. Declining Margins
    if (q.length >= 4) {
        const recentOPM = q[0]?.opm || 0
        const olderOPM = q[3]?.opm || 0
        const marginChange = recentOPM - olderOPM
        flags.push({
            check: 'Operating Margin Trend',
            status: marginChange > 0 ? 'ok' : marginChange > -3 ? 'watch' : 'danger',
            detail: marginChange >= 0
                ? `OPM expanded ${marginChange.toFixed(1)}pp over 4 quarters`
                : `OPM contracted ${Math.abs(marginChange).toFixed(1)}pp over 4 quarters`
        })
    }

    // 3. Rising Debt
    const de = v.debtToEquity || 0
    flags.push({
        check: 'Debt Level (D/E)',
        status: de < 0.5 ? 'ok' : de < 1.5 ? 'watch' : 'danger',
        detail: de === 0 ? 'Debt-free' : `D/E ratio: ${de.toFixed(2)}`
    })

    // 4. Insider Activity
    const insiders = data.insiderActivity || []
    const buys = insiders.filter((t: any) => t.type?.toLowerCase().includes('purchase') || t.type?.toLowerCase().includes('buy'))
    const sells = insiders.filter((t: any) => t.type?.toLowerCase().includes('sale') || t.type?.toLowerCase().includes('sell'))
    flags.push({
        check: 'Insider Activity (6M)',
        status: buys.length >= sells.length ? 'ok' : sells.length > buys.length + 2 ? 'danger' : 'watch',
        detail: `${buys.length} buys, ${sells.length} sells in recent transactions`
    })

    // 5. Cash Flow vs Profit
    if (q.length > 0 && cf.length > 0) {
        const profit = q[0]?.netProfit || 0
        const ocf = cf[0]?.operatingCF || 0
        flags.push({
            check: 'Cash Flow Quality',
            status: ocf >= profit ? 'ok' : ocf > 0 ? 'watch' : 'danger',
            detail: ocf >= profit ? 'Operating CF exceeds net profit' : ocf > 0 ? 'Operating CF lower than net profit' : 'Negative operating cash flow'
        })
    }

    // 6. Promoter Holding Level
    const promo = v.promoterHolding || 0
    if (promo > 0) {
        flags.push({
            check: 'Promoter Holding',
            status: promo > 50 ? 'ok' : promo > 30 ? 'watch' : 'danger',
            detail: `Promoters hold ${promo.toFixed(1)}% of the company`
        })
    }

    // 7. Valuation Check (PE)
    const pe = v.peRatio || 0
    if (pe > 0) {
        flags.push({
            check: 'Valuation (P/E)',
            status: pe < 25 ? 'ok' : pe < 50 ? 'watch' : 'danger',
            detail: pe < 25 ? `P/E of ${pe.toFixed(1)} looks reasonable` : pe < 50 ? `P/E of ${pe.toFixed(1)} — moderately expensive` : `P/E of ${pe.toFixed(1)} — extremely expensive`
        })
    }

    // 8. Revenue Growth
    const revGr = v.revenueGrowth || 0
    flags.push({
        check: 'Revenue Growth',
        status: revGr > 5 ? 'ok' : revGr > -5 ? 'watch' : 'danger',
        detail: revGr > 0 ? `Growing at ${revGr.toFixed(1)}% YoY` : `Revenue declining ${Math.abs(revGr).toFixed(1)}% YoY`
    })

    // 9. Free Cash Flow
    const fcf = v.freeCashFlow || 0
    flags.push({
        check: 'Free Cash Flow',
        status: fcf > 0 ? 'ok' : 'danger',
        detail: fcf > 0 ? `Positive FCF: generating free cash` : 'Negative FCF: burning cash'
    })

    return flags
}

function getOverallGrade(flags: FlagResult[]): { grade: string; color: string } {
    const dangerCount = flags.filter(f => f.status === 'danger').length
    const watchCount = flags.filter(f => f.status === 'watch').length
    if (dangerCount >= 3) return { grade: 'D', color: 'text-red-500' }
    if (dangerCount >= 2) return { grade: 'C', color: 'text-red-500' }
    if (dangerCount >= 1 || watchCount >= 3) return { grade: 'B', color: 'text-amber-500' }
    if (watchCount >= 1) return { grade: 'A', color: 'text-green-500' }
    return { grade: 'A+', color: 'text-green-600' }
}

const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ok') return <ShieldCheck className="h-5 w-5 text-green-500" />
    if (status === 'watch') return <ShieldQuestion className="h-5 w-5 text-amber-500" />
    return <ShieldAlert className="h-5 w-5 text-red-500" />
}

const statusLabel: Record<string, { label: string; bg: string; text: string }> = {
    ok: { label: 'OK', bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
    watch: { label: 'WATCH', bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
    danger: { label: 'DANGER', bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
}

export default function RedFlagsTab({ data }: Props) {
    const flags = computeFlags(data)
    const { grade, color } = getOverallGrade(flags)

    return (
        <div className="space-y-6">
            {/* Overall Grade */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Overall Health Score</p>
                <p className={`text-6xl font-black ${color}`}>{grade}</p>
                <p className="text-sm text-slate-500 mt-2">
                    {flags.filter(f => f.status === 'ok').length} OK ·{' '}
                    {flags.filter(f => f.status === 'watch').length} Watch ·{' '}
                    {flags.filter(f => f.status === 'danger').length} Danger
                </p>
            </div>

            {/* Flag Details */}
            <div className="space-y-3">
                {flags.map((f, i) => {
                    const st = statusLabel[f.status]
                    return (
                        <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4">
                            <StatusIcon status={f.status} />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{f.check}</p>
                                <p className="text-xs text-slate-500">{f.detail}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
