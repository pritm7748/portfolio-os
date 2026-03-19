'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Loader2, TrendingUp, X, Microscope } from 'lucide-react'
import UltimateAnalysis from '@/components/ultimate-analysis/index'

// Popular Indian stocks for quick access
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

export default function AnalysisPage() {
    const [query, setQuery] = useState('')
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [recentSearches, setRecentSearches] = useState<string[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    // Load recent searches from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('analysis-recent')
            if (saved) setRecentSearches(JSON.parse(saved))
        } catch { }
    }, [])

    const saveRecent = (ticker: string) => {
        const updated = [ticker, ...recentSearches.filter(s => s !== ticker)].slice(0, 6)
        setRecentSearches(updated)
        try { localStorage.setItem('analysis-recent', JSON.stringify(updated)) } catch { }
    }

    const analyzeStock = async (ticker: string) => {
        const cleanTicker = ticker.trim().toUpperCase()
        if (!cleanTicker) return

        setSelectedTicker(cleanTicker)
        setLoading(true)
        setError('')
        setData(null)
        setQuery('')
        saveRecent(cleanTicker)

        try {
            const res = await fetch('/api/stock-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: cleanTicker })
            })
            if (!res.ok) throw new Error('Failed to fetch analysis data')
            const json = await res.json()
            setData(json)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') analyzeStock(query)
    }

    // Filter suggestions
    const suggestions = query.length >= 1
        ? POPULAR_STOCKS.filter(s =>
            s.symbol.toLowerCase().includes(query.toLowerCase()) ||
            s.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 6)
        : []

    const clearAnalysis = () => {
        setSelectedTicker(null)
        setData(null)
        setError('')
        setTimeout(() => inputRef.current?.focus(), 100)
    }

    return (
        <div className="min-h-screen">

            {/* Search Bar */}
            <div className="relative mb-6">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search stock by symbol or name (e.g., TCS, Reliance)..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                        />
                        {query && (
                            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
                                <X className="h-3.5 w-3.5" />
                            </button>
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

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && !selectedTicker && (
                    <div className="absolute left-0 top-full z-30 mt-1 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
                        {suggestions.map(s => (
                            <button
                                key={s.symbol}
                                onClick={() => analyzeStock(s.symbol)}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                            >
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{s.symbol}</p>
                                    <p className="text-[11px] text-slate-500">{s.name}</p>
                                </div>
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
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Microscope className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicker}</h2>
                                <p className="text-xs text-slate-500">Fundamental Analysis</p>
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
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Fetching data from multiple sources...
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
                        <UltimateAnalysis ticker={selectedTicker} data={data} />
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

                    {/* Mutual Funds placeholder */}
                    <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
                        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
                            🏗️ Mutual Fund Analysis — Coming Soon
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
