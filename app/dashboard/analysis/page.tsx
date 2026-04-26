'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, TrendingUp, X, Microscope, Building2, BarChart3 } from 'lucide-react'
import UltimateAnalysis from '@/components/ultimate-analysis/index'
import MfAnalysis from '@/components/mf-analysis/index'

// Popular stocks for quick access on empty state
const POPULAR_STOCKS = [
    { symbol: 'RELIANCE', name: 'Reliance Industries' },
    { symbol: 'TCS', name: 'Tata Consultancy Services' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
    { symbol: 'ITC', name: 'ITC Ltd' },
    { symbol: 'SBIN', name: 'State Bank of India' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
    { symbol: 'LT', name: 'Larsen & Toubro' },
    { symbol: 'WIPRO', name: 'Wipro' },
    { symbol: 'HCLTECH', name: 'HCL Technologies' },
    { symbol: 'ADANIENT', name: 'Adani Enterprises' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki' },
    { symbol: 'SUNPHARMA', name: 'Sun Pharma' },
    { symbol: 'TITAN', name: 'Titan Company' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance' },
    { symbol: 'ASIANPAINT', name: 'Asian Paints' },
]

type SearchResult = {
    symbol: string
    name: string
    exchange: string
    type: string
    yahooSymbol: string
}

export default function AnalysisPage() {
    const [query, setQuery] = useState('')
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
    const [isMf, setIsMf] = useState(false)
    const [selectedName, setSelectedName] = useState('')
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [recentSearches, setRecentSearches] = useState<string[]>([])
    const [suggestions, setSuggestions] = useState<SearchResult[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightIdx, setHighlightIdx] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Load recent searches from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('analysis-recent')
            if (saved) setRecentSearches(JSON.parse(saved))
        } catch { }
    }, [])

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const saveRecent = (ticker: string) => {
        const updated = [ticker, ...recentSearches.filter(s => s !== ticker)].slice(0, 6)
        setRecentSearches(updated)
        try { localStorage.setItem('analysis-recent', JSON.stringify(updated)) } catch { }
    }

    // Debounced Yahoo search
    const searchYahoo = useCallback((q: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (q.length < 1) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }
        setSearchLoading(true)
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/stock-search?q=${encodeURIComponent(q)}`)
                const json = await res.json()
                setSuggestions(json.results || [])
                setShowSuggestions(true)
                setHighlightIdx(-1)
            } catch {
                setSuggestions([])
            } finally {
                setSearchLoading(false)
            }
        }, 300) // 300ms debounce
    }, [])

    const handleQueryChange = (val: string) => {
        setQuery(val)
        searchYahoo(val)
    }

    const analyzeStock = async (ticker: string, type?: string, name?: string) => {
        const cleanTicker = ticker.trim().toUpperCase()
        if (!cleanTicker) return

        const mfMode = type === 'MUTUALFUND'
        setSelectedTicker(cleanTicker)
        setIsMf(mfMode)
        setSelectedName(name || cleanTicker)
        setLoading(true)
        setError('')
        setData(null)
        setQuery('')
        setSuggestions([])
        setShowSuggestions(false)
        saveRecent(cleanTicker)

        try {
            if (mfMode) {
                // ticker may be a scheme code (numeric) from MFAPI search
                const schemeCode = /^\d+$/.test(ticker.trim()) ? ticker.trim() : undefined
                const res = await fetch('/api/mf-analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fundName: name || ticker, schemeCode })
                })
                if (!res.ok) throw new Error('Failed to fetch MF analysis data')
                const json = await res.json()
                setData(json)
            } else {
                const res = await fetch('/api/stock-analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker: cleanTicker })
                })
                if (!res.ok) throw new Error('Failed to fetch analysis data')
                const json = await res.json()
                setData(json)
            }
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false)
            return
        }
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1))
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightIdx(prev => Math.max(prev - 1, -1))
                return
            }
            if (e.key === 'Enter' && highlightIdx >= 0) {
                e.preventDefault()
                const s = suggestions[highlightIdx]
                analyzeStock(s.symbol, s.type, s.name)
                return
            }
        }
        if (e.key === 'Enter') analyzeStock(query)
    }

    const clearAnalysis = () => {
        setSelectedTicker(null)
        setData(null)
        setError('')
        setIsMf(false)
        setSelectedName('')
        setTimeout(() => inputRef.current?.focus(), 100)
    }

    // Type icon helper
    const TypeIcon = ({ type }: { type: string }) => {
        if (type === 'MUTUALFUND') return <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        if (type === 'ETF') return <Building2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        return <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
    }

    const typeBadge = (type: string) => {
        const labels: Record<string, string> = {
            EQUITY: 'Stock',
            MUTUALFUND: 'MF',
            ETF: 'ETF',
            INDEX: 'Index',
        }
        const colors: Record<string, string> = {
            EQUITY: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
            MUTUALFUND: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
            ETF: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
            INDEX: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
        }
        return (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${colors[type] || colors.EQUITY}`}>
                {labels[type] || type}
            </span>
        )
    }

    return (
        <div className="min-h-screen">

            {/* Search Bar */}
            <div className="relative mb-6" ref={dropdownRef}>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => handleQueryChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            placeholder="Search any stock, ETF, or mutual fund..."
                            className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                        />
                        {(query || searchLoading) && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {searchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />}
                                {query && (
                                    <button onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false) }} className="p-0.5 text-slate-400 hover:text-slate-600">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => analyzeStock(query)}
                        disabled={!query.trim() || loading}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Microscope className="h-4 w-4" />
                        Analyze
                    </button>
                </div>

                {/* Live search suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && !selectedTicker && (
                    <div className="absolute left-0 top-full z-30 mt-1 w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
                        {suggestions.map((s, i) => (
                            <button
                                key={`${s.yahooSymbol}-${i}`}
                                onClick={() => analyzeStock(s.symbol, s.type, s.name)}
                                className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition ${
                                    i === highlightIdx
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.type === 'MUTUALFUND' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                                    <TypeIcon type={s.type} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                            {s.type === 'MUTUALFUND' ? s.name : s.symbol}
                                        </p>
                                        {typeBadge(s.type)}
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate">
                                        {s.type === 'MUTUALFUND' ? s.exchange : s.name}
                                    </p>
                                </div>
                                <span className="text-[10px] text-slate-400 shrink-0">{s.type === 'MUTUALFUND' ? '' : s.exchange}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Analysis Content */}
            {selectedTicker ? (
                <div>
                    {/* Active analysis header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isMf ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20'}`}>
                                {isMf ? <BarChart3 className="h-5 w-5 text-white" /> : <Microscope className="h-5 w-5 text-white" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isMf ? selectedName : selectedTicker}</h2>
                                <p className="text-xs text-slate-500">{isMf ? 'Mutual Fund Analysis' : 'Fundamental Analysis'}</p>
                            </div>
                        </div>
                        <button
                            onClick={clearAnalysis}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                            ← New Search
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <Loader2 className={`h-10 w-10 animate-spin ${isMf ? 'text-emerald-500' : 'text-indigo-500'}`} />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {isMf ? 'Analyzing mutual fund data...' : 'Fetching data from multiple sources...'}
                            </p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20">
                            <p className="text-red-500 font-medium">{error}</p>
                            <button onClick={clearAnalysis} className="mt-4 text-sm text-indigo-600 hover:underline">
                                ← Try another stock
                            </button>
                        </div>
                    ) : data ? (
                        isMf ? <MfAnalysis data={data} fundName={selectedName} onAnalyzePeer={(peerName) => analyzeStock(peerName, 'MUTUALFUND', peerName)} /> : <UltimateAnalysis ticker={selectedTicker} data={data} />
                    ) : null}
                </div>
            ) : (
                /* Landing state — show recent + popular */
                <div className="space-y-8">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                        <div>
                            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Recent</h3>
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => analyzeStock(s)}
                                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-sm"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Popular Stocks Grid */}
                    <div>
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Popular Stocks</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {POPULAR_STOCKS.map(s => (
                                <button
                                    key={s.symbol}
                                    onClick={() => analyzeStock(s.symbol)}
                                    className="group flex flex-col items-start p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-200"
                                >
                                    <span className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{s.symbol}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Popular MFs */}
                    <div>
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Popular Mutual Funds</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {[
                                { name: 'Axis Bluechip Fund', symbol: 'AXISBLUECHIP' },
                                { name: 'Parag Parikh Flexi Cap', symbol: 'PPFCF' },
                                { name: 'HDFC Mid-Cap Opportunities', symbol: 'HDFCMIDCAP' },
                                { name: 'SBI Small Cap Fund', symbol: 'SBISMALLCAP' },
                                { name: 'Mirae Asset Large Cap', symbol: 'MIRAELARGECAP' },
                                { name: 'Kotak Emerging Equity', symbol: 'KOTAKEMERGING' },
                                { name: 'ICICI Pru Bluechip', symbol: 'ICICIBLUECHIP' },
                                { name: 'Nippon India Small Cap', symbol: 'NIPPONSMALLCAP' },
                            ].map(f => (
                                <button
                                    key={f.symbol}
                                    onClick={() => analyzeStock(f.symbol, 'MUTUALFUND', f.name)}
                                    className="group flex flex-col items-start p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-200"
                                >
                                    <BarChart3 className="h-3.5 w-3.5 text-emerald-500 mb-1" />
                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold leading-tight">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
