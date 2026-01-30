'use client'

import { AlertTriangle, ArrowDown, Info, ShieldCheck } from 'lucide-react'

type Props = {
    beta: number
    netWorth: number
}

// Historical "Black Swan" Events for Indian Markets (NIFTY 50)
const SCENARIOS = [
    { 
        name: "Covid Crash (2020)", 
        marketDrop: -0.38, 
        desc: "Pandemic panic selling" 
    },
    { 
        name: "2008 Financial Crisis", 
        marketDrop: -0.51, 
        desc: "Global banking collapse" 
    },
    { 
        name: "Tech Bubble (2000)", 
        marketDrop: -0.53, 
        desc: "Dot-com bubble burst" 
    },
    { 
        name: "Generic Correction", 
        marketDrop: -0.10, 
        desc: "Standard market pullback" 
    }
]

export default function StressTest({ beta, netWorth }: Props) {
    
    // Safety check: If beta is 0 or missing, assume 1 (Market Beta)
    const safeBeta = beta || 1

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" /> 
                        Stress Test Lab
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        How your portfolio would perform during historical crashes based on its current Beta ({safeBeta.toFixed(2)}x).
                    </p>
                </div>
            </div>

            <div className="space-y-4 flex-1">
                {SCENARIOS.map((scenario) => {
                    // Logic: Portfolio Drop = Market Drop * Beta
                    // We cap the loss at -100% (can't lose more than you have)
                    let estimatedDrop = scenario.marketDrop * safeBeta
                    if (estimatedDrop < -1) estimatedDrop = -1

                    const estimatedLossValue = netWorth * estimatedDrop

                    // Determine color based on severity
                    const isSevere = Math.abs(estimatedDrop) > 0.40
                    const barColor = isSevere ? 'bg-red-500' : 'bg-orange-500'
                    const bgColor = isSevere ? 'bg-red-50 dark:bg-red-900/10' : 'bg-orange-50 dark:bg-orange-900/10'
                    const borderColor = isSevere ? 'border-red-100 dark:border-red-900/30' : 'border-orange-100 dark:border-orange-900/30'
                    const iconColor = isSevere ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                    const iconBg = isSevere ? 'bg-red-100 dark:bg-red-900/20' : 'bg-orange-100 dark:bg-orange-900/20'

                    return (
                        <div key={scenario.name} className={`group relative overflow-hidden rounded-lg border p-4 transition-all hover:shadow-md ${bgColor} ${borderColor}`}>
                            
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
                                        <ArrowDown className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{scenario.name}</h4>
                                        <p className="text-[10px] text-slate-500">{scenario.desc} (Nifty {(scenario.marketDrop * 100).toFixed(0)}%)</p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className={`text-sm font-bold ${iconColor}`}>
                                        {(estimatedDrop * 100).toFixed(1)}%
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono">
                                        -₹{Math.abs(estimatedLossValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>

                            {/* Visual Progress Bar Background */}
                            <div 
                                className={`absolute bottom-0 left-0 h-1 ${barColor} opacity-20 transition-all duration-500 group-hover:h-full group-hover:opacity-10`} 
                                style={{ width: `${Math.min(Math.abs(estimatedDrop) * 100, 100)}%` }}
                            />
                        </div>
                    )
                })}
            </div>

            <div className="mt-4 flex gap-2 text-[10px] text-slate-400 items-start bg-slate-50 dark:bg-slate-800 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                <Info className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
                <p>
                    This simulation assumes your portfolio's correlation to the market remains constant. 
                    {safeBeta < 1 
                        ? " Your portfolio is defensive (Beta < 1), so you likely fall less than the market."
                        : " Your portfolio is aggressive (Beta > 1), so you likely fall harder than the market."
                    }
                </p>
            </div>
        </div>
    )
}