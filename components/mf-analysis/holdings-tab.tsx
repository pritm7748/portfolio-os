'use client'

import { useState } from 'react'
import { Search, Plus, Minus, ArrowUpRight, ArrowDownRight, X, ChevronDown, ChevronUp } from 'lucide-react'

type Props = { data: any }

export default function HoldingsTab({ data }: Props) {
    const { holdings } = data
    const current = holdings?.current || []
    const changes = holdings?.changes || {}
    const [search, setSearch] = useState('')
    const [showAll, setShowAll] = useState(false)
    const [activeChangeTab, setActiveChangeTab] = useState<'additions' | 'exits' | 'increased' | 'decreased'>('additions')

    const filtered = current.filter((h: any) =>
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        (h.sector || '').toLowerCase().includes(search.toLowerCase())
    )
    const displayed = showAll ? filtered : filtered.slice(0, 20)
    const hasChanges = (changes.additions?.length || 0) + (changes.exits?.length || 0) + (changes.increased?.length || 0) + (changes.decreased?.length || 0) > 0

    const changeTabs = [
        { id: 'additions' as const, label: 'New Additions', count: changes.additions?.length || 0, icon: Plus, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        { id: 'exits' as const, label: 'Exits', count: changes.exits?.length || 0, icon: X, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
        { id: 'increased' as const, label: 'Increased', count: changes.increased?.length || 0, icon: ArrowUpRight, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { id: 'decreased' as const, label: 'Decreased', count: changes.decreased?.length || 0, icon: ArrowDownRight, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    ]

    const activeChanges = changes[activeChangeTab] || []

    return (
        <div className="space-y-6">
            {/* Portfolio Changes Section */}
            {hasChanges && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Portfolio Changes (Month-over-Month)</h3>

                    {/* Change Type Tabs */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                        {changeTabs.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeChangeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveChangeTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
                                        isActive
                                            ? `${tab.bg} ${tab.color} border-current`
                                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-white dark:bg-slate-800/50'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/50 dark:bg-black/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Changes List */}
                    {activeChanges.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {activeChanges.map((c: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${changeTabs.find(t => t.id === activeChangeTab)?.bg}`}>
                                        {activeChangeTab === 'additions' && <Plus className="h-4 w-4 text-emerald-600" />}
                                        {activeChangeTab === 'exits' && <X className="h-4 w-4 text-red-500" />}
                                        {activeChangeTab === 'increased' && <ArrowUpRight className="h-4 w-4 text-blue-600" />}
                                        {activeChangeTab === 'decreased' && <ArrowDownRight className="h-4 w-4 text-amber-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{c.name}</p>
                                        <p className="text-[10px] text-slate-400">{c.sector}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {activeChangeTab === 'additions' && <span className="text-sm font-bold text-emerald-600">{c.weight?.toFixed(2)}%</span>}
                                        {activeChangeTab === 'exits' && <span className="text-sm font-bold text-red-500">{c.lastWeight?.toFixed(2)}%</span>}
                                        {(activeChangeTab === 'increased' || activeChangeTab === 'decreased') && (
                                            <div>
                                                <span className="text-sm font-bold text-slate-800 dark:text-white">{c.currentWeight?.toFixed(2)}%</span>
                                                <p className={`text-[10px] font-semibold ${c.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {c.change >= 0 ? '+' : ''}{c.change?.toFixed(2)}%
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 p-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            No {changeTabs.find(t => t.id === activeChangeTab)?.label.toLowerCase()} this month
                        </p>
                    )}
                </div>
            )}

            {/* Current Holdings */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                        Current Holdings ({current.length})
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search holdings..."
                            className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48"
                        />
                    </div>
                </div>

                {/* Holdings Table */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">#</th>
                                <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Stock</th>
                                <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sector</th>
                                <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Weight</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayed.map((h: any, i: number) => (
                                <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                    <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                                    <td className="px-4 py-2.5">
                                        <span className="font-medium text-slate-800 dark:text-white">{h.name}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-xs text-slate-500">{h.sector}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(h.weight * 10, 100)}%` }} />
                                            </div>
                                            <span className="font-semibold text-slate-800 dark:text-white w-12 text-right">{h.weight.toFixed(2)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filtered.length > 20 && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="mt-3 w-full py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition flex items-center justify-center gap-1"
                    >
                        {showAll ? <><ChevronUp className="h-3.5 w-3.5" /> Show Top 20</> : <><ChevronDown className="h-3.5 w-3.5" /> Show All {filtered.length} Holdings</>}
                    </button>
                )}
            </div>
        </div>
    )
}
