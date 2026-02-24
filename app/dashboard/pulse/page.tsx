'use client'

import { useMemo, useState } from 'react'
// FIX: Imported useActiveAssets instead of useTransactions
import { useActiveAssets, usePulse } from '@/hooks/use-portfolio-data'
import {
    Loader2, Calendar, TrendingUp, TrendingDown, Briefcase, Zap, Globe, Activity,
    HelpCircle, Gift, FileText, ArrowRightLeft, ChevronDown, ChevronUp, Lock, Unlock,
    AlertTriangle, ShieldCheck, Layers, RefreshCcw, Scissors, Users, Landmark, Gavel,
    DollarSign, PieChart, ArrowDownRight
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════
//  1. EVENT TYPE CONFIG
// ════════════════════════════════════════════════════════════════

const EVENT_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
    'Dividend': { icon: DollarSign, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    'Split': { icon: Scissors, color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
    'Bonus': { icon: Gift, color: 'text-pink-700 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800' },
    'Rights': { icon: FileText, color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' },
    'Buyback': { icon: ArrowDownRight, color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
    'Board Meeting': { icon: Users, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    'Earnings': { icon: PieChart, color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800' },
    'Corporate Action': { icon: Landmark, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' },
}

const getEventConfig = (type: string) => EVENT_CONFIG[type] || EVENT_CONFIG['Corporate Action']

// ════════════════════════════════════════════════════════════════
//  2. FORENSIC TRANSACTION CLASSIFIER (Insider Activity)
// ════════════════════════════════════════════════════════════════

const getTransactionType = (txn: any) => {
    // Clean inputs
    const raw = (txn.action || '').toLowerCase().trim()
    const shares = Number(txn.shares) || 0
    const value = Number(txn.value) || 0
    const price = shares !== 0 ? Math.abs(value / shares) : 0

    // Helper: Regex Matcher
    const is = (pattern: RegExp) => pattern.test(raw)

    // --- PRIORITY 1: BLOCK & BULK DEALS ---
    if (is(/block|bulk/)) {
        if (is(/sale|sold|dispos|divest/)) return { label: 'Block Deal (Sell)', color: 'text-red-700 bg-red-50', icon: Layers }
        if (is(/purchase|buy|acqui/)) return { label: 'Block Deal (Buy)', color: 'text-green-700 bg-green-50', icon: Layers }
        return { label: 'Block Deal', color: 'text-indigo-700 bg-indigo-50', icon: Layers }
    }

    // --- PRIORITY 2: PLEDGES ---
    if (is(/invok/)) return { label: 'Pledge Invoked', color: 'text-red-700 bg-red-50', icon: AlertTriangle }
    if (is(/revok|release|clos/)) return { label: 'Pledge Revoked', color: 'text-green-600 bg-green-50', icon: Unlock }
    if (is(/creat|pledge/)) return { label: 'Pledge Created', color: 'text-orange-600 bg-orange-50', icon: Lock }

    // --- PRIORITY 3: TRANSFERS (Must check before Buy/Sell) ---
    if (is(/inter-se|inter se/)) return { label: 'Inter-se Transfer', color: 'text-slate-600 bg-slate-100', icon: ArrowRightLeft }
    if (is(/off market|off-market/)) return { label: 'Off-Market Deal', color: 'text-slate-600 bg-slate-100', icon: ArrowRightLeft }
    if (is(/gift|donat/)) return { label: 'Gift / Donation', color: 'text-pink-600 bg-pink-50', icon: Gift }
    if (is(/transfer|transmission/)) return { label: 'Transfer', color: 'text-slate-600 bg-slate-100', icon: ArrowRightLeft }

    // --- PRIORITY 4: NEGATIVE ACTIONS (Sell/Disposal) ---
    if (is(/dispos|sell|sold|sale|divest/)) return { label: 'Strategic Sell', color: 'text-red-600 bg-red-50', icon: TrendingDown }

    // --- PRIORITY 5: POSITIVE ACTIONS (Buy/Acquisition) ---
    if (is(/creeping/)) return { label: 'Creeping Acq.', color: 'text-green-700 bg-green-50', icon: TrendingUp }
    if (is(/market purchase|open market/)) return { label: 'Market Buy', color: 'text-green-600 bg-green-50', icon: TrendingUp }
    if (is(/acqui|buy|bought|purchase|subscri/)) return { label: 'Strategic Buy', color: 'text-green-600 bg-green-50', icon: TrendingUp }

    // --- PRIORITY 6: CORPORATE ACTIONS ---
    if (is(/esop|exercise|vest|employee/)) return { label: 'ESOP Exercise', color: 'text-blue-600 bg-blue-50', icon: FileText }
    if (is(/rights/)) return { label: 'Rights Issue', color: 'text-indigo-600 bg-indigo-50', icon: FileText }
    if (is(/bonus/)) return { label: 'Bonus Issue', color: 'text-indigo-600 bg-indigo-50', icon: Gift }
    if (is(/allotment|preferential|conversion|warrant/)) return { label: 'Pref. Allotment', color: 'text-indigo-600 bg-indigo-50', icon: ShieldCheck }

    // --- PRIORITY 7: FALLBACKS ---
    if (price < 0.5 && shares > 0) return { label: 'Non-Market Add', color: 'text-slate-500 bg-slate-100', icon: Activity }
    if (shares < 0) return { label: 'Strategic Sell', color: 'text-orange-600 bg-orange-50', icon: TrendingDown }
    if (shares > 0) return { label: 'Strategic Add', color: 'text-teal-600 bg-teal-50', icon: TrendingUp }

    const cleanText = (txn.action || '').replace(/acquisition|disposal|shares|of/gi, '').trim()
    return {
        label: cleanText.length > 20 ? 'Update' : (cleanText || 'Reporting'),
        color: 'text-slate-500 bg-slate-50',
        icon: HelpCircle
    }
}

// ════════════════════════════════════════════════════════════════
//  3. RESPONSIVE SECTION COMPONENT
// ════════════════════════════════════════════════════════════════

const Section = ({ title, icon: Icon, badge, children, isOpen, onToggle }: any) => {
    return (
        <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm h-fit">
            {/* MOBILE: Accordion */}
            <button
                onClick={onToggle}
                className="md:hidden w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50"
            >
                <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-indigo-500" /> {title}
                    {badge > 0 && (
                        <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
                    )}
                </span>
                {isOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>

            {/* DESKTOP: Static Header */}
            <div className="hidden md:flex p-4 pb-3 items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                <Icon className="h-5 w-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
                {badge > 0 && (
                    <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
                )}
            </div>

            {/* CONTENT */}
            <div className={`${isOpen ? 'block' : 'hidden'} md:block p-4 animate-in slide-in-from-top-2 md:animate-none`}>
                {children}
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════
//  4. MAIN PAGE
// ════════════════════════════════════════════════════════════════

export default function PulsePage() {
    const activeAssets = useActiveAssets()
    const [openSection, setOpenSection] = useState<string | null>('radar')

    const toggleSection = (id: string) => setOpenSection(current => current === id ? null : id)

    // Extract Tickers from the clean list
    const activeTickers = useMemo(() => {
        return activeAssets.map(asset => asset.ticker)
    }, [activeAssets])

    // Pass CLEAN ticker list to Pulse API
    const { data, isLoading } = usePulse(activeTickers)

    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

    return (
        <div className="space-y-8 pb-20">

            {/* MACRO DECK */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {data?.macro?.map((m: any, i: number) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {m.type === 'Currency' ? <Globe className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                            {m.name}
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-lg font-bold text-slate-900 dark:text-white">
                                {m.prefix}{Number(m.price || 0).toFixed(2)}{m.suffix}
                            </span>
                            <span className={`text-xs font-medium ${(m.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(m.change || 0) > 0 ? '+' : ''}{Number(m.change || 0).toFixed(2)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:grid md:grid-cols-3 gap-6">

                {/* BIG MONEY RADAR */}
                <Section title="Big Money Radar" icon={Zap} badge={data?.shockers?.length || 0} isOpen={openSection === 'radar'} onToggle={() => toggleSection('radar')}>
                    <div className="space-y-3">
                        {!data?.shockers || data.shockers.length === 0 ? (
                            <div className="text-center py-8"><p className="text-sm text-slate-400">No unusual volume detected in your watchlist.</p></div>
                        ) : (
                            data.shockers.map((s: any, i: number) => (
                                <div key={i} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 p-3 dark:bg-amber-900/10 dark:border-amber-900/30">
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{s.ticker}</h4>
                                        <span className={`text-xs font-medium ${(s.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(s.change || 0) > 0 ? '+' : ''}{Number(s.change || 0).toFixed(2)}% Today
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-base font-bold text-amber-600 dark:text-amber-500">{s.ratio}</span>
                                        <span className="text-[10px] text-slate-500 uppercase">Vol vs Avg</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Section>

                {/* EVENTS — Now with type-specific badges & icons */}
                <Section title="Upcoming Events" icon={Calendar} badge={data?.events?.length || 0} isOpen={openSection === 'events'} onToggle={() => toggleSection('events')}>
                    <div className="space-y-3">
                        {!data?.events || data.events.length === 0 ? (
                            <div className="text-center py-8"><p className="text-sm text-slate-400">No upcoming events.</p></div>
                        ) : (
                            data.events.map((event: any, i: number) => {
                                const config = getEventConfig(event.type)
                                const EventIcon = config.icon
                                return (
                                    <div key={i} className={`flex items-center gap-3 rounded-lg border p-3 ${config.bg}`}>
                                        {/* Date Block with Type Icon */}
                                        <div className="flex flex-col items-center justify-center rounded-md p-2 min-w-[48px] bg-white/80 dark:bg-slate-900/50">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                {new Date(event.date).toLocaleString('default', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                                                {new Date(event.date).getDate()}
                                            </span>
                                        </div>
                                        {/* Event Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{event.ticker}</h4>
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${config.color} bg-white/60 dark:bg-slate-900/50`}>
                                                    <EventIcon className="h-2.5 w-2.5" /> {event.type}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{event.desc}</p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Section>

                {/* INSIDERS */}
                <Section title="Insider Activity" icon={Briefcase} badge={data?.insiders?.length || 0} isOpen={openSection === 'insiders'} onToggle={() => toggleSection('insiders')}>
                    <div className="space-y-3">
                        {!data?.insiders || data.insiders.length === 0 ? (
                            <div className="text-center py-8"><p className="text-sm text-slate-400">No recent insider trades.</p></div>
                        ) : (
                            data.insiders.map((txn: any, i: number) => {
                                const { label, color, icon: Icon } = getTransactionType(txn)
                                return (
                                    <div key={i} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 min-w-0 mr-2">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{txn.ticker}</h4>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1" title={txn.holder}>
                                                    {txn.holder} <span className="opacity-70">({txn.relation})</span>
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded dark:bg-slate-800">
                                                {new Date(txn.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${color}`}>
                                                    <Icon className="h-3 w-3" /> {label}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                {(txn.value || 0) > 0 && !label.includes('Update') ? (
                                                    <span className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                                        {txn.value > 10000000 ? `₹${(txn.value / 10000000).toFixed(2)}Cr` : `₹${(txn.value / 100000).toFixed(2)}L`}
                                                    </span>
                                                ) : (
                                                    <span className="block text-[10px] text-slate-400 italic">Reported</span>
                                                )}
                                                <span className="block text-[9px] text-slate-400 font-medium">
                                                    {Math.abs(txn.shares || 0) > 1000 ? (Math.abs(txn.shares || 0) / 1000).toFixed(1) + 'k' : Math.abs(txn.shares || 0)} Shares
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Section>

            </div>
        </div>
    )
}