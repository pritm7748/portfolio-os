'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

type Props = {
    transactions: any[]
    priceMap: any
}

export default function MonthlyReturnsMatrix({ transactions, priceMap }: Props) {
    // Derive tickers from transactions
    const tickers = useMemo(() => {
        if (!transactions) return []
        const set = new Set<string>()
        transactions.forEach(t => {
            if (t.transaction_type === 'Buy' || t.transaction_type === 'Sell') {
                set.add(t.assets.ticker)
            }
        })
        return Array.from(set)
    }, [transactions])

    // Prepare flat transactions for the API
    const flatTxns = useMemo(() => {
        if (!transactions) return []
        return transactions
            .filter(t => t.transaction_type === 'Buy' || t.transaction_type === 'Sell')
            .map(t => ({
                date: t.date,
                transaction_type: t.transaction_type,
                ticker: t.assets.ticker,
                quantity: t.quantity,
                price: t.price,
            }))
    }, [transactions])

    // Fetch real monthly returns from the API
    const { data: apiData, isLoading } = useQuery({
        queryKey: ['monthly-returns', tickers.join(',')],
        queryFn: async () => {
            if (tickers.length === 0) return null
            const res = await fetch('/api/monthly-returns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers, transactions: flatTxns }),
            })
            return res.json()
        },
        enabled: tickers.length > 0 && flatTxns.length > 0,
        staleTime: 1000 * 60 * 30, // 30 min
        refetchOnWindowFocus: false,
    })

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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Computing monthly returns from market data...</span>
            </div>
        )
    }

    const matrix = apiData?.matrix
    if (!matrix || matrix.length === 0) {
        return <div className="text-center text-xs text-slate-400 py-6">Need more transaction history to generate returns matrix.</div>
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
                        {matrix.map((row: any) => (
                            <tr key={row.year}>
                                <td className="font-bold text-slate-700 dark:text-slate-200 text-left py-2">{row.year}</td>
                                {row.months.map((val: number | null, i: number) => (
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
            <div className="mt-auto pt-2 flex justify-between items-center">
                <span className="text-[9px] text-slate-400 italic">Modified Dietz returns (cash-flow adjusted)</span>
                <div className="flex gap-3 text-[9px] text-slate-400">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-600 rounded-sm"></div> &lt; -5%</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-red-100 dark:bg-red-900/40 rounded-sm border border-red-200 dark:border-red-800"></div> -5 to 0%</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-green-100 dark:bg-green-900/40 rounded-sm border border-green-200 dark:border-green-800"></div> 0 to 5%</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-green-600 rounded-sm"></div> &gt; 5%</div>
                </div>
            </div>
        </div>
    )
}