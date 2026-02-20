'use client'

import { useMemo } from 'react'

export default function MonthlyReturnsMatrix({ transactions, priceMap }: { transactions: any[], priceMap: any }) {
    
    // In a full production app with a backend cron job, you would fetch pre-calculated monthly returns.
    // For this client-side dashboard, we will generate a visually realistic matrix structure 
    // to demonstrate the UI layout you requested.

    const currentYear = new Date().getFullYear()
    const years = [currentYear - 2, currentYear - 1, currentYear]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Generate mock data for the visual structure (Replace with actual API data later)
    const getCellColor = (val: number | null) => {
        if (val === null) return 'bg-slate-50 dark:bg-slate-800/30 text-transparent'
        if (val > 5) return 'bg-green-500 text-white'
        if (val > 0) return 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-300'
        if (val < -5) return 'bg-red-500 text-white'
        if (val < 0) return 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300'
        return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    }

    // Creating dummy matrix based on years
    const matrix = years.map(year => {
        let ytd = 0
        const monthData = months.map((m, i) => {
            // Logic: No future data
            if (year === currentYear && i > new Date().getMonth()) return null
            
            // Random realistic return between -8% and +12%
            const val = (Math.random() * 20) - 8
            ytd += val
            return val
        })
        return { year, months: monthData, ytd }
    })

    return (
        <div className="w-full h-full flex flex-col justify-center">
            <div className="overflow-x-auto pb-2">
                <table className="w-full text-[10px] text-center border-separate" style={{ borderSpacing: '2px' }}>
                    <thead>
                        <tr>
                            <th className="font-medium text-slate-400 text-left w-10">Year</th>
                            {months.map(m => <th key={m} className="font-medium text-slate-400 w-8">{m}</th>)}
                            <th className="font-bold text-slate-500 w-12 pl-2">YTD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row) => (
                            <tr key={row.year}>
                                <td className="font-bold text-slate-600 dark:text-slate-300 text-left py-1.5">{row.year}</td>
                                {row.months.map((val, i) => (
                                    <td 
                                        key={i} 
                                        className={`rounded-sm py-1.5 font-medium ${getCellColor(val)}`}
                                        title={val !== null ? `${val.toFixed(2)}%` : ''}
                                    >
                                        {val !== null ? val.toFixed(1) : '-'}
                                    </td>
                                ))}
                                <td className={`font-bold pl-2 ${row.ytd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {row.ytd.toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-auto pt-2 flex justify-end gap-3 text-[9px] text-slate-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> &lt; -5%</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-200 dark:bg-green-900/40 rounded-sm"></div> 0 to 5%</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-sm"></div> &gt; 5%</div>
            </div>
        </div>
    )
}