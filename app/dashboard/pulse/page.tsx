'use client'

import { useMemo, useState } from 'react'
// FIX: Imported useActiveAssets instead of useTransactions
import { useActiveAssets, usePulse } from '@/hooks/use-portfolio-data'
import {
    Loader2, Calendar, TrendingUp, TrendingDown, Zap, Globe, Activity,
    Gift, FileText, ChevronDown, ChevronUp,
    Scissors, Users, Landmark, ExternalLink,
    DollarSign, PieChart, ArrowDownRight, RefreshCw, Filter, Search, X,
    Briefcase, Megaphone, Building2
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
    'Fund Raising': { icon: Briefcase, color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800' },
    'Investor Meet': { icon: Megaphone, color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    'AGM': { icon: Building2, color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
    'EGM': { icon: Building2, color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
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
    const { data, isLoading, isCached, progress, forceRefresh } = usePulse(activeTickers)

    // Filings filters
    const [filingsTickerFilter, setFilingsTickerFilter] = useState<string>('')
    const [filingsTypeFilter, setFilingsTypeFilter] = useState<string>('all')
    const [tickerSearch, setTickerSearch] = useState('')

    // Get unique tickers and classify filing types from publications
    const filingsTickers = useMemo(() => {
        if (!data?.publications) return []
        return [...new Set(data.publications.map((p: any) => p.ticker))].sort()
    }, [data?.publications])

    const FILING_TYPES = [
        { key: 'all', label: 'All' },
        { key: 'dividend', label: 'Dividends' },
        { key: 'board', label: 'Board Changes' },
        { key: 'result', label: 'Results' },
        { key: 'agm', label: 'AGM/EGM' },
        { key: 'rights', label: 'Rights/Bonus' },
        { key: 'other', label: 'Other' },
    ]

    const classifyFiling = (title: string): string => {
        const t = (title || '').toLowerCase()
        if (t.includes('dividend')) return 'dividend'
        if (t.includes('board') || t.includes('director') || t.includes('appointment') || t.includes('resignation') || t.includes('cessation')) return 'board'
        if (t.includes('result') || t.includes('financial') || t.includes('quarter') || t.includes('annual') || t.includes('earning')) return 'result'
        if (t.includes('agm') || t.includes('egm') || t.includes('general meeting') || t.includes('postal ballot')) return 'agm'
        if (t.includes('rights') || t.includes('bonus') || t.includes('split') || t.includes('buyback')) return 'rights'
        return 'other'
    }

    const filteredPublications = useMemo(() => {
        if (!data?.publications) return []
        return data.publications.filter((pub: any) => {
            if (filingsTickerFilter && pub.ticker !== filingsTickerFilter) return false
            if (filingsTypeFilter !== 'all' && classifyFiling(pub.title) !== filingsTypeFilter) return false
            return true
        })
    }, [data?.publications, filingsTickerFilter, filingsTypeFilter])

    const filteredTickerOptions = useMemo((): string[] => {
        if (!tickerSearch) return filingsTickers as string[]
        return (filingsTickers as string[]).filter((t: string) => t.toLowerCase().includes(tickerSearch.toLowerCase()))
    }, [filingsTickers, tickerSearch])

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

            {/* CACHED BADGE + REFRESH */}
            {!isLoading && isCached && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-400">Showing cached data</span>
                    <button
                        onClick={forceRefresh}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition"
                    >
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
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

                {/* COMPANY FILINGS — with filters */}
                <Section title="Company Filings" icon={FileText} badge={data?.publications?.length || 0} isOpen={openSection === 'filings'} onToggle={() => toggleSection('filings')}>
                    {/* FILTERS */}
                    {data?.publications?.length > 0 && (
                        <div className="space-y-3 mb-4">
                            {/* Type filter chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {FILING_TYPES.map(ft => (
                                    <button
                                        key={ft.key}
                                        onClick={() => setFilingsTypeFilter(ft.key)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                                            filingsTypeFilter === ft.key
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {ft.label}
                                    </button>
                                ))}
                            </div>

                            {/* Ticker filter */}
                            <div className="relative">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                        <input
                                            type="text"
                                            value={tickerSearch}
                                            onChange={e => setTickerSearch(e.target.value)}
                                            placeholder="Filter by stock..."
                                            className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                    </div>
                                    {filingsTickerFilter && (
                                        <button
                                            onClick={() => { setFilingsTickerFilter(''); setTickerSearch('') }}
                                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold"
                                        >
                                            {filingsTickerFilter} <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                {tickerSearch && !filingsTickerFilter && filteredTickerOptions.length > 0 && (
                                    <div className="absolute z-10 mt-1 left-0 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                                        {filteredTickerOptions.map((t: string) => (
                                            <button
                                                key={t}
                                                onClick={() => { setFilingsTickerFilter(t); setTickerSearch('') }}
                                                className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* FILTERED RESULTS */}
                    <div className="space-y-3">
                        {filteredPublications.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-400">
                                    {data?.publications?.length > 0 ? 'No filings match your filters.' : 'No recent filings found.'}
                                </p>
                            </div>
                        ) : (
                            filteredPublications.map((pub: any, i: number) => (
                                <div key={i} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{pub.ticker}</h4>
                                                <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded dark:bg-slate-800">
                                                    {new Date(pub.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                                <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 uppercase">
                                                    {classifyFiling(pub.title)}
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