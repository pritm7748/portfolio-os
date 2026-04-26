'use client'

import { useState } from 'react'
import {
    BarChart3, TrendingUp, PieChart, Layers, GitCompare,
    ShieldAlert, Calculator, Sparkles
} from 'lucide-react'
import OverviewTab from './overview-tab'
import AllocationTab from './allocation-tab'
import HoldingsTab from './holdings-tab'
import PerformanceTab from './performance-tab'
import RiskTab from './risk-tab'
import PeersTab from './peers-tab'
import SipTab from './sip-tab'

type Props = { data: any; fundName: string; onAnalyzePeer?: (name: string) => void }

const TABS = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'allocation', label: 'Allocation', icon: PieChart },
    { id: 'holdings', label: 'Holdings', icon: Layers },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'risk', label: 'Risk', icon: ShieldAlert },
    { id: 'peers', label: 'Peers', icon: GitCompare },
    { id: 'sip', label: 'SIP Simulator', icon: Calculator },
]

export default function MfAnalysis({ data, fundName, onAnalyzePeer }: Props) {
    const [activeTab, setActiveTab] = useState('overview')

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
                                    ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
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
                {activeTab === 'overview' && <OverviewTab data={data} />}
                {activeTab === 'allocation' && <AllocationTab data={data} />}
                {activeTab === 'holdings' && <HoldingsTab data={data} />}
                {activeTab === 'performance' && <PerformanceTab data={data} />}
                {activeTab === 'risk' && <RiskTab data={data} />}
                {activeTab === 'peers' && <PeersTab data={data} onAnalyzePeer={onAnalyzePeer} />}
                {activeTab === 'sip' && <SipTab data={data} />}
            </div>
        </div>
    )
}
