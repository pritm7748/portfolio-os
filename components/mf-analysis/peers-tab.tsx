'use client'

import { useState } from 'react'
import { ArrowUpDown, Microscope } from 'lucide-react'

type Props = { data: any; onAnalyzePeer?: (name: string) => void }

type SortKey = 'name' | 'aum' | 'expenseRatio' | 'return1Y' | 'return3Y' | 'return5Y'

const fmt = (n: number) => {
    if (!n) return '—'
    if (n >= 1000) return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`
    if (n >= 1) return `₹${n.toFixed(0)} Cr`
    return `₹${(n * 100).toFixed(0)} L`
}

export default function PeersTab({ data, onAnalyzePeer }: Props) {
    const peers = data.peers || []
    const [sortKey, setSortKey] = useState<SortKey>('return3Y')
    const [sortAsc, setSortAsc] = useState(false)

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc)
        else { setSortKey(key); setSortAsc(false) }
    }

    const sorted = [...peers].sort((a: any, b: any) => {
        const av = a[sortKey] ?? -Infinity
        const bv = b[sortKey] ?? -Infinity
        return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

    const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
        <th
            className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition select-none"
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1 justify-end">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? 'text-emerald-500' : ''}`} />
            </div>
        </th>
    )

    if (peers.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-sm text-slate-400">No peer fund data available for this fund</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Peer Comparison ({peers.length} funds in category)
                </h3>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold min-w-[200px]">Fund</th>
                            <SortHeader label="AUM" field="aum" />
                            <SortHeader label="Expense" field="expenseRatio" />
                            <SortHeader label="1Y" field="return1Y" />
                            <SortHeader label="3Y" field="return3Y" />
                            <SortHeader label="5Y" field="return5Y" />
                            <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((p: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                <td className="px-3 py-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 dark:text-white text-xs leading-tight truncate max-w-[220px]">{p.name}</p>
                                        {onAnalyzePeer && p.name && (
                                            <button
                                                onClick={() => onAnalyzePeer(p.name)}
                                                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 mt-0.5"
                                            >
                                                <Microscope className="h-2.5 w-2.5" /> Analyze this fund
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-right text-xs text-slate-600 dark:text-slate-400">{fmt(p.aum)}</td>
                                <td className="px-3 py-3 text-right text-xs text-slate-600 dark:text-slate-400">{p.expenseRatio != null ? `${p.expenseRatio}%` : '—'}</td>
                                <td className="px-3 py-3 text-right">
                                    {p.return1Y != null ? (
                                        <span className={`text-xs font-semibold ${p.return1Y >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                            {p.return1Y >= 0 ? '+' : ''}{p.return1Y.toFixed(1)}%
                                        </span>
                                    ) : <span className="text-xs text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-3 text-right">
                                    {p.return3Y != null ? (
                                        <span className={`text-xs font-semibold ${p.return3Y >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                            {p.return3Y >= 0 ? '+' : ''}{p.return3Y.toFixed(1)}%
                                        </span>
                                    ) : <span className="text-xs text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-3 text-right">
                                    {p.return5Y != null ? (
                                        <span className={`text-xs font-semibold ${p.return5Y >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                            {p.return5Y >= 0 ? '+' : ''}{p.return5Y.toFixed(1)}%
                                        </span>
                                    ) : <span className="text-xs text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-3 text-center">
                                    {p.riskRating ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            {p.riskRating}
                                        </span>
                                    ) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
