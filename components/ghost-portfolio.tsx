'use client'

import { useMemo, useState } from 'react'
import { Ghost, TrendingUp, Info, EyeOff } from 'lucide-react'

// FIX: Updated 'id' to allow number or string to match your database
type Transaction = {
    id: number | string
    transaction_type: string
    date: string
    quantity: number
    price: number
    assets: {
        ticker: string
        name: string
    }
}

type Props = {
    transactions: Transaction[]
    priceMap: Record<string, { price: number; change: number }>
}

export default function GhostPortfolio({ transactions, priceMap }: Props) {
    const [view, setView] = useState<'missed' | 'dodged'>('missed')

    const ghostStats = useMemo(() => {
        if (!transactions) return null
        const sells = transactions.filter(t => t.transaction_type === 'Sell')
        if (sells.length === 0) return null

        // 1. Group Sells by Ticker
        const ghostHoldings: Record<string, { ticker: string; name: string; qty: number; totalSoldVal: number }> = {}

        sells.forEach(t => {
            const ticker = t.assets.ticker
            if (!ghostHoldings[ticker]) {
                ghostHoldings[ticker] = { 
                    ticker, 
                    name: t.assets.name, 
                    qty: 0, 
                    totalSoldVal: 0 
                }
            }
            ghostHoldings[ticker].qty += Number(t.quantity)
            ghostHoldings[ticker].totalSoldVal += (Number(t.quantity) * Number(t.price))
        })

        // 2. Calculate Opportunity Cost
        const analysis = Object.values(ghostHoldings).map(h => {
            const currentPrice = priceMap[h.ticker]?.price || 0
            if (currentPrice === 0) return null 

            const avgSellPrice = h.totalSoldVal / h.qty
            const currentValue = h.qty * currentPrice
            
            // Positive = Missed Gain (Regret)
            // Negative = Bullet Dodged (Relief)
            const opportunityPnL = currentValue - h.totalSoldVal 

            return {
                ...h,
                avgSellPrice,
                currentPrice,
                opportunityPnL,
                diffPercent: ((currentPrice - avgSellPrice) / avgSellPrice) * 100
            }
        }).filter(Boolean) as any[]

        const missedGains = analysis.filter(a => a.opportunityPnL > 0).sort((a, b) => b.opportunityPnL - a.opportunityPnL)
        const bulletsDodged = analysis.filter(a => a.opportunityPnL < 0).sort((a, b) => a.opportunityPnL - b.opportunityPnL)

        const totalMissed = missedGains.reduce((acc, curr) => acc + curr.opportunityPnL, 0)
        const totalSaved = Math.abs(bulletsDodged.reduce((acc, curr) => acc + curr.opportunityPnL, 0))

        return { missedGains, bulletsDodged, totalMissed, totalSaved }
    }, [transactions, priceMap])

    if (!ghostStats || (ghostStats.missedGains.length === 0 && ghostStats.bulletsDodged.length === 0)) return null

    const activeList = view === 'missed' ? ghostStats.missedGains : ghostStats.bulletsDodged

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Ghost className="h-5 w-5 text-purple-500" /> 
                        Ghost Portfolio
                    </h3>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setView('missed')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${
                                view === 'missed' 
                                ? 'bg-white dark:bg-slate-700 text-red-500 shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Regrets
                        </button>
                        <button
                            onClick={() => setView('dodged')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${
                                view === 'dodged' 
                                ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Relief
                        </button>
                    </div>
                </div>
                
                {/* Summary Stat */}
                <div className="flex items-center gap-2 mt-4">
                    <div className={`p-2 rounded-full ${view === 'missed' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {view === 'missed' ? <TrendingUp className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">{view === 'missed' ? 'Total Missed Gains' : 'Total Loss Avoided'}</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                            ₹{(view === 'missed' ? ghostStats.totalMissed : ghostStats.totalSaved).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto max-h-[300px]">
                {activeList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-xs">
                        <EyeOff className="h-8 w-8 mb-2 opacity-20" />
                        <p>No {view === 'missed' ? 'regrets' : 'dodged bullets'} found.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2">Stock</th>
                                <th className="px-4 py-2 text-right">Sold At</th>
                                <th className="px-4 py-2 text-right">Current</th>
                                <th className="px-4 py-2 text-right">{view === 'missed' ? 'Missed' : 'Saved'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {activeList.map((item: any) => (
                                <tr key={item.ticker} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                        {item.ticker.replace(/\.NS|\.BO/g, '')}
                                        <span className="block text-[10px] text-slate-400 font-normal">{item.qty} units</span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-500">
                                        ₹{item.avgSellPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                        ₹{item.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${view === 'missed' ? 'text-red-600' : 'text-green-600'}`}>
                                        {view === 'missed' ? '+' : ''}
                                        ₹{Math.abs(item.opportunityPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        <span className="block text-[10px] opacity-70 font-normal">
                                            {item.diffPercent.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <p>
                    {view === 'missed' 
                        ? "Money you would have made if you never sold." 
                        : "Money you saved by selling before the price dropped."}
                </p>
            </div>
        </div>
    )
}

function ShieldCheck({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
    )
}