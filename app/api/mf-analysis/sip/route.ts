// app/api/mf-analysis/sip/route.ts — Custom SIP simulation
import { NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function parseDate(d: string): Date {
    const [day, month, year] = d.split('-')
    const months: Record<string, number> = { '01': 0, '02': 1, '03': 2, '04': 3, '05': 4, '06': 5, '07': 6, '08': 7, '09': 8, '10': 9, '11': 10, '12': 11 }
    return new Date(+year, months[month] ?? 0, +day)
}

export async function POST(request: Request) {
    try {
        const { schemeCode, monthlyAmount, startYear, endYear } = await request.json()
        if (!schemeCode || !monthlyAmount) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, { headers: { 'User-Agent': UA } })
        if (!res.ok) return NextResponse.json({ error: 'MFAPI failed' }, { status: 502 })
        const data = await res.json()
        if (data.status !== 'SUCCESS') return NextResponse.json({ error: 'No data' }, { status: 404 })

        const navs = data.data
            .filter((d: any) => +d.nav > 0)
            .map((d: any) => ({ date: d.date, nav: +d.nav }))
            .reverse() // chronological

        const now = new Date()
        const sy = startYear || now.getFullYear() - 5
        const ey = endYear || now.getFullYear()
        const startDate = new Date(sy, 0, 1)
        const endDate = new Date(ey, 11, 31)

        let totalUnits = 0, totalInvested = 0, lastMonth = ''
        const chartData: { date: string; invested: number; value: number }[] = []

        for (const n of navs) {
            const d = parseDate(n.date)
            if (d < startDate || d > endDate) continue
            const mKey = `${d.getFullYear()}-${d.getMonth()}`
            if (mKey !== lastMonth) {
                totalUnits += monthlyAmount / n.nav
                totalInvested += monthlyAmount
                lastMonth = mKey
            }
            chartData.push({ date: n.date, invested: totalInvested, value: +(totalUnits * n.nav).toFixed(2) })
        }

        // Sample to ~120 points
        const sampled = chartData.length > 120
            ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 120) === 0 || i === chartData.length - 1)
            : chartData

        const lastNav = navs[navs.length - 1]?.nav || 0
        const currentValue = totalUnits * lastNav
        const years = totalInvested > 0 ? (now.getTime() - startDate.getTime()) / (365.25 * 24 * 3600 * 1000) : 0
        const approxXirr = years > 0 && totalInvested > 0
            ? (Math.pow(currentValue / totalInvested, 1 / Math.min(years, ey - sy)) - 1) * 100
            : 0

        // Lumpsum comparison: same total invested at start
        const startNav = navs.find((n: any) => parseDate(n.date) >= startDate)?.nav || 1
        const lumpsumUnits = totalInvested / startNav
        const lumpsumValue = lumpsumUnits * lastNav

        return NextResponse.json({
            monthlyAmount,
            totalInvested,
            currentValue: +currentValue.toFixed(2),
            totalUnits: +totalUnits.toFixed(4),
            approxCagr: +approxXirr.toFixed(2),
            absoluteReturn: totalInvested > 0 ? +(((currentValue - totalInvested) / totalInvested) * 100).toFixed(2) : 0,
            wealth: +(currentValue - totalInvested).toFixed(2),
            lumpsum: {
                invested: totalInvested,
                value: +lumpsumValue.toFixed(2),
                return: totalInvested > 0 ? +(((lumpsumValue - totalInvested) / totalInvested) * 100).toFixed(2) : 0,
            },
            chartData: sampled,
            period: { from: sy, to: ey },
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
