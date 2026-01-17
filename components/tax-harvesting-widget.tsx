'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Leaf } from 'lucide-react'
import { calculateTaxHarvesting, TaxLot } from '@/lib/tax-utils'
import { Transaction } from '@/hooks/use-portfolio-data'

type Props = {
    transactions: Transaction[]
    priceMap: Record<string, any>
}

export default function TaxHarvestingWidget({ transactions, priceMap }: Props) {
    const [selectedLots, setSelectedLots] = useState<string[]>([]) 

    const taxReport = useMemo(() => {
        if (!transactions) return null
        return calculateTaxHarvesting(transactions, priceMap || {})
    }, [transactions, priceMap])

    const simulated = useMemo(() => {
        if (!taxReport) return { newNetST: 0, newNetLT: 0, harvestedST: 0, harvestedLT: 0 }
        
        let simStcl = 0
        let simLtcl = 0

        const allOps = [...(taxReport.opportunities.stcl || []), ...(taxReport.opportunities.ltcl || [])]
        
        allOps.forEach(lot => {
            const id = `${lot.ticker}-${lot.buyDate}-${lot.quantity}`
            if (selectedLots.includes(id)) {
                if (lot.type === 'ST') simStcl += Math.abs(lot.unrealizedPnL)
                else simLtcl += Math.abs(lot.unrealizedPnL)
            }
        })

        return {
            newNetST: taxReport.realized.netShortTerm - simStcl,
            newNetLT: taxReport.realized.netLongTerm - simLtcl,
            harvestedST: simStcl,
            harvestedLT: simLtcl
        }
    }, [selectedLots, taxReport])

    if (!taxReport) return null
    const { realized, opportunities } = taxReport

    const toggleLot = (lot: TaxLot) => {
        const id = `${lot.ticker}-${lot.buyDate}-${lot.quantity}`
        if (selectedLots.includes(id)) setSelectedLots(prev => prev.filter(i => i !== id))
        else setSelectedLots(prev => [...prev, id])
    }

    const renderTable = (lots: TaxLot[], title: string, currentGain: number) => {
        if (!lots || lots.length === 0) return (
            <div className="text-sm text-slate-400 italic p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No {title} opportunities found.
            </div>
        )

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{title} Opportunities</span>
                    <span className="text-xs text-slate-500">
                        Target Offset: <span className="font-mono text-red-500">₹{currentGain.toLocaleString('en-IN')}</span>
                    </span>
                </div>
                <div className="border rounded-lg border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                            <tr>
                                <th className="p-3 w-8"></th>
                                <th className="p-3">Asset</th>
                                <th className="p-3 text-right">Loss</th>
                                <th className="p-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lots.map((lot, idx) => {
                                const id = `${lot.ticker}-${lot.buyDate}-${lot.quantity}`
                                const isSelected = selectedLots.includes(id)
                                return (
                                    <tr key={idx} className={`transition ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                                        <td className="p-3">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected} 
                                                onChange={() => toggleLot(lot)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-3 font-medium">
                                            <div className="text-slate-900 dark:text-white">{lot.ticker}</div>
                                            <div className="text-[10px] text-slate-500">{lot.buyDate} ({lot.daysHeld}d)</div>
                                        </td>
                                        <td className="p-3 text-right font-mono text-red-500 font-medium">
                                            -₹{Math.abs(lot.unrealizedPnL).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className={`text-[10px] px-2 py-1 rounded-full border ${isSelected ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'border-slate-200 text-slate-400'}`}>
                                                {isSelected ? 'Harvesting' : 'Select'}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-indigo-50 dark:bg-slate-800/50 border border-indigo-100 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3">
                <Leaf className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tax Harvesting Simulator</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Select loss-making assets below to simulate offsetting your realized gains for this financial year.
                        STCG can only be offset by Short Term Losses. LTCG can be offset by Long Term Losses.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SHORT TERM */}
                <div className={`rounded-xl border p-5 ${realized.netShortTerm > 0 ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900' : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Short Term Gains (STCG)</h3>
                            <p className="text-xs text-slate-500 mt-1">Taxed at 20% (India)</p>
                        </div>
                        {realized.netShortTerm > 0 && <AlertCircle className="h-5 w-5 text-amber-500" />}
                    </div>
                    
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="text-xs text-slate-500 mb-1">Net Gain</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                ₹{realized.netShortTerm.toLocaleString('en-IN')}
                            </div>
                        </div>
                        {simulated.harvestedST > 0 && (
                            <div className="text-right animate-pulse">
                                <div className="text-xs text-indigo-600 font-semibold mb-1">New Net Gain</div>
                                <div className="text-xl font-bold text-indigo-600">
                                    ₹{simulated.newNetST.toLocaleString('en-IN')}
                                </div>
                            </div>
                        )}
                    </div>

                    {realized.netShortTerm > 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-amber-900/30">
                            {renderTable(opportunities.stcl, 'Short Term Loss', realized.netShortTerm)}
                        </div>
                    )}
                </div>

                {/* LONG TERM */}
                <div className={`rounded-xl border p-5 ${realized.netLongTerm > 100000 ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900' : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Long Term Gains (LTCG)</h3>
                            <p className="text-xs text-slate-500 mt-1">Tax-free up to ₹1.25 Lakh</p>
                        </div>
                        {realized.netLongTerm > 100000 && <AlertCircle className="h-5 w-5 text-amber-500" />}
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <div className="text-xs text-slate-500 mb-1">Net Gain</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                ₹{realized.netLongTerm.toLocaleString('en-IN')}
                            </div>
                        </div>
                        {simulated.harvestedLT > 0 && (
                            <div className="text-right animate-pulse">
                                <div className="text-xs text-indigo-600 font-semibold mb-1">New Net Gain</div>
                                <div className="text-xl font-bold text-indigo-600">
                                    ₹{simulated.newNetLT.toLocaleString('en-IN')}
                                </div>
                            </div>
                        )}
                    </div>

                    {realized.netLongTerm > 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-amber-900/30">
                            {renderTable(opportunities.ltcl, 'Long Term Loss', realized.netLongTerm)}
                        </div>
                    )}
                </div>
            </div>

            {/* IMPACT SUMMARY */}
            {(simulated.harvestedST > 0 || simulated.harvestedLT > 0) && (
                <div className="bg-indigo-600 text-white rounded-xl p-6 shadow-lg flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" /> Harvesting Simulation
                        </h4>
                        <p className="text-indigo-100 text-sm">
                            Total Loss to Book: <b>₹{(simulated.harvestedST + simulated.harvestedLT).toLocaleString('en-IN')}</b>
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Est. Tax Saved</div>
                        <div className="text-2xl font-bold">
                            ₹{(simulated.harvestedST * 0.20 + simulated.harvestedLT * 0.125).toLocaleString('en-IN', {maximumFractionDigits: 0})}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}