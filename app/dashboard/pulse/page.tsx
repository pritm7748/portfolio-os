'use client'

import { useMemo, useState } from 'react'
// FIX: Imported useActiveAssets instead of useTransactions
import { useActiveAssets, usePulse } from '@/hooks/use-portfolio-data'
import {
    Loader2, Calendar, TrendingUp, TrendingDown, Zap, Globe, Activity,
    Gift, FileText, ChevronDown, ChevronUp,
    Scissors, Users, Landmark, ExternalLink,
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

// (Insider classifier removed — replaced by Company Filings)

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

    // Pass CLEAN ticker list to Pulse API (now streaming)
    const { data, isLoading, progress } = usePulse(activeTickers)

    return (
        <div className="space-y-8 pb-20">

            {/* PROGRESS BAR — shows during streaming */}
            {isLoading && progress && (
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                {progress.label}
                            </span>
                        </div>
                        {progress.total > 0 && (
                            <span className="text-xs text-indigo-500 tabular-nums">
                                {progress.done}/{progress.total}
                            </span>
                        )}
                    </div>
                    {progress.total > 0 && (
                        <div className="w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-full h-1.5">
                            <div
                                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                style={{ width: `${Math.min((progress.done / progress.total) * 100, 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

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

                {/* COMPANY FILINGS */}
                <Section title="Company Filings" icon={FileText} badge={data?.publications?.length || 0} isOpen={openSection === 'filings'} onToggle={() => toggleSection('filings')}>
                    <div className="space-y-3">
                        {!data?.publications || data.publications.length === 0 ? (
                            <div className="text-center py-8"><p className="text-sm text-slate-400">No recent filings found.</p></div>
                        ) : (
                            data.publications.map((pub: any, i: number) => (
                                <div key={i} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{pub.ticker}</h4>
                                                <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded dark:bg-slate-800">
                                                    {new Date(pub.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{pub.title}</p>
                                        </div>
                                    </div>
                                    {pub.pdfUrl && (
                                        <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
                                            <a
                                                href={pub.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                View Document
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </Section>

            </div>
        </div>
    )
}