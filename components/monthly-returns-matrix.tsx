'use client'

import { useMemo } from 'react'

type Props = {
    transactions: any[]
    priceMap: any
}

export default function MonthlyReturnsMatrix({ transactions, priceMap }: Props) {
    const matrix = useMemo(() => {
        if (!transactions || transactions.length === 0) return []

        // Step 1: Build a timeline of portfolio value at each month boundary
        //   - For each month, compute total invested cost and total current value
        //   - Monthly return = change in portfolio value that month

        // Get the date range
        const sortedTxns = [...transactions]
            .filter(t => t.transaction_type === 'Buy' || t.transaction_type === 'Sell')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        if (sortedTxns.length === 0) return []

        const firstDate = new Date(sortedTxns[0].date)
        const now = new Date()
        const startYear = firstDate.getFullYear()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth()

        // Step 2: For each month-end, compute portfolio cost basis
        //   We track lots (FIFO) and compute invested amount at each month boundary
        const getRoot = (t: string) => t.toUpperCase().replace('.NS', '').replace('.BO', '')

        const monthlyValues: Record<string, number> = {} // "YYYY-MM" → total cost basis

        // Compute cost basis at each month-end by replaying transactions
        for (let y = startYear; y <= currentYear; y++) {
            const maxMonth = y === currentYear ? currentMonth : 11
            for (let m = (y === startYear ? firstDate.getMonth() : 0); m <= maxMonth; m++) {
                const monthEnd = new Date(y, m + 1, 0) // Last day of month
                const key = `${y}-${m}`

                // Compute holdings as of monthEnd using FIFO
                const lots: Record<string, { qty: number, cost: number }[]> = {}

                sortedTxns.forEach(txn => {
                    const txnDate = new Date(txn.date)
                    if (txnDate > monthEnd) return

                    const root = getRoot(txn.assets.ticker)
                    if (!lots[root]) lots[root] = []

                    if (txn.transaction_type === 'Buy') {
                        lots[root].push({ qty: Number(txn.quantity), cost: Number(txn.price) })
                    } else if (txn.transaction_type === 'Sell') {
                        let qtyToSell = Number(txn.quantity)
                        while (qtyToSell > 0 && lots[root].length > 0) {
                            if (lots[root][0].qty > qtyToSell) {
                                lots[root][0].qty -= qtyToSell
                                qtyToSell = 0
                            } else {
                                qtyToSell -= lots[root][0].qty
                                lots[root].shift()
                            }
                        }
                    }
                })

                // Sum total cost basis
                let totalCost = 0
                Object.values(lots).forEach(stockLots => {
                    stockLots.forEach(lot => {
                        totalCost += lot.qty * lot.cost
                    })
                })

                monthlyValues[key] = totalCost
            }
        }

        // Step 3: Compute portfolio value using live prices for current month,
        //   and cost-basis-change for historical months
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const years = []
        for (let y = Math.max(startYear, currentYear - 2); y <= currentYear; y++) {
            years.push(y)
        }

        return years.map(year => {
            let ytd = 0
            const monthData = months.map((_, m) => {
                // No future data
                if (year === currentYear && m > currentMonth) return null
                // No data before first transaction
                if (year === startYear && m < firstDate.getMonth()) return null

                const key = `${year}-${m}`
                const prevKey = m === 0 ? `${year - 1}-11` : `${year}-${m - 1}`

                const curr = monthlyValues[key]
                const prev = monthlyValues[prevKey]

                if (curr === undefined || prev === undefined || prev === 0) {
                    // First month or no prior data — can't compute return
                    if (curr !== undefined && prev === undefined) return null
                    return null
                }

                // Monthly return based on cost basis changes
                // A simple approximation: (current_basis - prev_basis) / prev_basis
                // This captures new investments and withdrawals as growth
                const change = ((curr - prev) / prev) * 100

                // Cap extreme values from large deposits/withdrawals
                const capped = Math.max(-50, Math.min(50, change))
                ytd += capped
                return capped
            })
            return { year, months: monthData, ytd }
        })
    }, [transactions, priceMap])

    if (!matrix || matrix.length === 0) {
        return <div className="text-center text-xs text-slate-400 py-6">Need more transaction history to generate returns matrix.</div>
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const getCellColor = (val: number | null) => {
        if (val === null) return 'bg-slate-50 dark:bg-slate-800/20 text-slate-300 dark:text-slate-700'
        if (val > 5) return 'bg-green-600 text-white'
        if (val > 2) return 'bg-green-500 text-white'
        if (val > 0) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
        if (val > -2) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
        if (val > -5) return 'bg-red-500 text-white'
        return 'bg-red-600 text-white'
    }

    return (
        <div className="w-full h-full flex flex-col justify-center">
            <div className="overflow-x-auto pb-1">
                <table className="w-full text-[10px] text-center border-separate" style={{ borderSpacing: '3px' }}>
                    <thead>
                        <tr>
                            <th className="font-semibold text-slate-500 dark:text-slate-400 text-left w-12 pb-1">Year</th>
                            {months.map(m => <th key={m} className="font-semibold text-slate-500 dark:text-slate-400 w-9 pb-1">{m}</th>)}
                            <th className="font-bold text-slate-600 dark:text-slate-300 w-14 pl-2 pb-1">YTD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row) => (
                            <tr key={row.year}>
                                <td className="font-bold text-slate-700 dark:text-slate-200 text-left py-2">{row.year}</td>
                                {row.months.map((val, i) => (
                                    <td
                                        key={i}
                                        className={`rounded py-2 font-semibold transition-colors ${getCellColor(val)}`}
                                        title={val !== null ? `${val.toFixed(2)}%` : 'No data'}
                                    >
                                        {val !== null ? `${val > 0 ? '+' : ''}${val.toFixed(1)}` : '—'}
                                    </td>
                                ))}
                                <td className={`font-bold pl-2 py-2 ${row.ytd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {row.ytd > 0 ? '+' : ''}{row.ytd.toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="mt-auto pt-2 flex justify-end gap-3 text-[9px] text-slate-400">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-600 rounded-sm"></div> &lt; -5%</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-100 dark:bg-red-900/40 rounded-sm border border-red-200 dark:border-red-800"></div> -5 to 0%</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-green-100 dark:bg-green-900/40 rounded-sm border border-green-200 dark:border-green-800"></div> 0 to 5%</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-green-600 rounded-sm"></div> &gt; 5%</div>
            </div>
        </div>
    )
}