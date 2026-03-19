'use client'

import { useState } from 'react'
import {
    BarChart3, TrendingUp, Landmark, Users, Target,
    AlertTriangle, Brain, GitCompare, Sparkles
} from 'lucide-react'
import ValuationTab from './valuation-tab'
import QuarterlyTab from './quarterly-tab'
import BalanceSheetTab from './balance-sheet-tab'
import PeerComparisonTab from './peer-comparison-tab'
import ShareholdingTab from './shareholding-tab'
import DcfTab from './dcf-tab'
import RedFlagsTab from './red-flags-tab'
import ConcallTab from './concall-tab'
import InsightsTab from './insights-tab'

type Props = { ticker: string; data: any }

const TABS = [
    { id: 'valuation', label: 'Valuation', icon: BarChart3 },
    { id: 'quarterly', label: 'Quarterly', icon: TrendingUp },
    { id: 'balance', label: 'Balance Sheet', icon: Landmark },
    { id: 'peers', label: 'Peers', icon: GitCompare },
    { id: 'shareholding', label: 'Shareholding', icon: Users },
    { id: 'dcf', label: 'DCF & Fair Value', icon: Target },
    { id: 'redflags', label: 'Red Flags', icon: AlertTriangle },
    { id: 'concall', label: 'Concall AI', icon: Brain },
    { id: 'insights', label: 'Insights', icon: Sparkles },
]

export default function UltimateAnalysis({ ticker, data }: Props) {
    const [activeTab, setActiveTab] = useState('valuation')

    return (
        <div>
            {/* Tab Navigation */}
            <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-slate-200 dark:border-slate-800 scrollbar-thin">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-all border-b-2 -mb-[1px] ${
                                isActive
                                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'valuation' && <ValuationTab data={data.valuation} />}
                {activeTab === 'quarterly' && <QuarterlyTab quarters={data.quarters} earningsHistory={data.earningsHistory} />}
                {activeTab === 'balance' && <BalanceSheetTab balanceSheet={data.balanceSheet} cashFlow={data.cashFlow} />}
                {activeTab === 'peers' && <PeerComparisonTab ticker={ticker} peerSymbols={data.peerSymbols} />}
                {activeTab === 'shareholding' && <ShareholdingTab
                    shareholding={data.shareholding}
                    holdersBreakdown={data.holdersBreakdown}
                    insiderActivity={data.insiderActivity}
                />}
                {activeTab === 'dcf' && <DcfTab
                    valuation={data.valuation}
                    cashFlow={data.cashFlow}
                    recommendationTrend={data.recommendationTrend}
                    upgrades={data.upgrades}
                />}
                {activeTab === 'redflags' && <RedFlagsTab data={data} />}
                {activeTab === 'concall' && <ConcallTab ticker={ticker} concallLinks={data.concallLinks} />}
                {activeTab === 'insights' && <InsightsTab
                    ticker={ticker}
                    companyName={data.valuation?.companyName || ticker}
                    insightsStructure={data.insightsStructure}
                />}
            </div>
        </div>
    )
}
