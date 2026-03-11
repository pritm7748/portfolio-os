'use client'

import { useState, useEffect } from 'react'
import { Loader2, ArrowUpDown } from 'lucide-react'

type Props = {
    ticker: string
    peerSymbols: string[]
}

type PeerData = {
    ticker: string
    marketCap: number
    peRatio: number
    pbRatio: number
    evEbitda: number
    roe: number
    divYield: number
    currentPrice: number
    revenueGrowth: number
    profitMargin: number
    debtToEquity: number
}

const fmtCr = (n: number) => {
    if (!n) return '—'
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T'
    if (n >= 1e10) return (n / 1e10).toFixed(1) + 'K Cr'
    if (n >= 1e7) return (n / 1e7).toFixed(0) + ' Cr'
    return n.toLocaleString('en-IN')
}

const fmtNum = (n: number) => n ? n.toFixed(1) : '—'
const fmtPct = (n: number) => n ? n.toFixed(1) + '%' : '—'

const COLS = [
    { key: 'ticker', label: 'Company', align: 'left' as const },
    { key: 'marketCap', label: 'MCap', align: 'right' as const },
    { key: 'peRatio', label: 'P/E', align: 'right' as const },
    { key: 'pbRatio', label: 'P/B', align: 'right' as const },
    { key: 'evEbitda', label: 'EV/EBITDA', align: 'right' as const },
    { key: 'roe', label: 'ROE%', align: 'right' as const },
    { key: 'divYield', label: 'Div%', align: 'right' as const },
    { key: 'revenueGrowth', label: 'Rev Gr%', align: 'right' as const },
    { key: 'profitMargin', label: 'NPM%', align: 'right' as const },
    { key: 'debtToEquity', label: 'D/E', align: 'right' as const },
]

function getRank(data: PeerData[], key: string, idx: number, higherBetter: boolean): number {
    const vals = data.map((d: any) => d[key] || 0)
    const sorted = [...vals].sort((a, b) => higherBetter ? b - a : a - b)
    return sorted.indexOf(vals[idx]) + 1
}

export default function PeerComparisonTab({ ticker, peerSymbols }: Props) {
    const [data, setData] = useState<PeerData[]>([])
    const [loading, setLoading] = useState(false)
    const [sortKey, setSortKey] = useState('marketCap')
    const [sortDesc, setSortDesc] = useState(true)

    const mainSymbol = ticker.replace('.NS', '').replace('.BO', '').toUpperCase()

    useEffect(() => {
        if (!peerSymbols?.length) return
        setLoading(true)
        fetch('/api/peer-comparison', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: mainSymbol, peers: peerSymbols })
        })
            .then(r => r.json())
            .then(d => setData(d.comparison || []))
            .catch(() => setData([]))
            .finally(() => setLoading(false))
    }, [peerSymbols, mainSymbol])

    if (!peerSymbols?.length) return <p className="text-sm text-slate-400 py-8 text-center">No peers detected for this stock</p>

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-500">Loading peer data...</p>
        </div>
    )

    const sorted = [...data].sort((a: any, b: any) => {
        const av = a[sortKey] || 0
        const bv = b[sortKey] || 0
        return sortDesc ? bv - av : av - bv
    })

    const handleSort = (key: string) => {
        if (sortKey === key) setSortDesc(!sortDesc)
        else { setSortKey(key); setSortDesc(true) }
    }

    const formatCell = (key: string, val: number) => {
        if (key === 'marketCap') return fmtCr(val)
        if (key === 'ticker') return ''
        if (['roe', 'divYield', 'revenueGrowth', 'profitMargin'].includes(key)) return fmtPct(val)
        return fmtNum(val)
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            {COLS.map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => col.key !== 'ticker' && handleSort(col.key)}
                                    className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.key !== 'ticker' ? 'cursor-pointer hover:text-indigo-600' : ''}`}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {col.label}
                                        {sortKey === col.key && <ArrowUpDown className="h-3 w-3" />}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((peer, i) => {
                            const isMain = peer.ticker.toUpperCase() === mainSymbol
                            return (
                                <tr key={i} className={`border-b border-slate-50 dark:border-slate-800 transition ${isMain ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                                        <span className={isMain ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-800 dark:text-white'}>
                                            {isMain && '★ '}{peer.ticker}
                                        </span>
                                    </td>
                                    {COLS.slice(1).map(col => (
                                        <td key={col.key} className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                            {formatCell(col.key, (peer as any)[col.key])}
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
