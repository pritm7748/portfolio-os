'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useTransactions, useNewsPreferences, useNews } from '@/hooks/use-portfolio-data'
import { Loader2, Star, BellOff, ExternalLink, Newspaper, Filter, Globe, Search, X } from 'lucide-react'

// --- COMPREHENSIVE GLOBAL & INDIAN MACRO LIST ---
const GENERAL_TOPICS = [
    "US Federal Reserve Powell",
    "RBI Monetary Policy India",
    "Brent Crude Oil Price",
    "Gold Price USD",
    "Nifty 50 Sensex",
    "Global Stock Markets",
    "US Inflation CPI Data",
    "India Inflation CPI WPI",
    "US GDP Growth",
    "India GDP Growth",
    "US Treasury Bond Yields",
    "India 10 Year Bond Yield",
    "Dollar Index DXY",
    "USD INR Forex",
    "OPEC Oil Production",
    "Silver Price Trends",
    "Copper Prices LME",
    "Geopolitical Tensions Trade War",
    "China Economic Stimulus",
    "Eurozone ECB Policy",
    "Bank of Japan Policy",
    "FII DII Activity India",
    "India GST Collections"
]

export default function NewsPage() {
  // State handles: 'ALL', 'GENERAL', 'SEARCH:term', or Ticker
  const [selectedTicker, setSelectedTicker] = useState<string>('ALL')
  const [customSearch, setCustomSearch] = useState('')
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // 1. Fetch Data
  const { data: transactions } = useTransactions()
  const { data: prefs } = useNewsPreferences()

  // 2. Process Holdings List
  const holdings = useMemo(() => {
      if (!transactions) return []
      
      const map: Record<string, { name: string, value: number }> = {}
      transactions.forEach(t => {
          const val = t.transaction_type === 'Buy' ? (t.price * t.quantity) : -(t.price * t.quantity)
          if (!map[t.assets.ticker]) map[t.assets.ticker] = { name: t.assets.name, value: 0 }
          map[t.assets.ticker].value += val
      })

      const list = Object.entries(map).map(([ticker, data]) => ({ ticker, ...data }))

      return list.sort((a, b) => {
          // Provide default objects to avoid TS errors
          const aPref = prefs?.[a.ticker] || { is_favorite: false, is_muted: false }
          const bPref = prefs?.[b.ticker] || { is_favorite: false, is_muted: false }

          if (aPref.is_favorite && !bPref.is_favorite) return -1
          if (!aPref.is_favorite && bPref.is_favorite) return 1
          if (aPref.is_muted && !bPref.is_muted) return 1
          if (!aPref.is_muted && bPref.is_muted) return -1
          return b.value - a.value
      })
  }, [transactions, prefs])

  // 3. Build Query List
  const searchQueries = useMemo(() => {
      // CASE A: Custom Search
      if (selectedTicker.startsWith('SEARCH:')) {
          return [selectedTicker.replace('SEARCH:', '')]
      }

      // CASE B: Single Holding
      if (selectedTicker !== 'ALL' && selectedTicker !== 'GENERAL') {
          const asset = holdings.find(h => h.ticker === selectedTicker)
          return asset ? [asset.name] : []
      }

      // CASE C: General Markets (Macro)
      if (selectedTicker === 'GENERAL') {
          return GENERAL_TOPICS
      }

      // CASE D: Smart Feed (Top Holdings + Favorites)
      return holdings
        .filter(h => {
            const p = prefs?.[h.ticker]
            if (p?.is_muted) return false 
            if (p?.is_favorite) return true 
            return true 
        })
        .slice(0, 15) // Increased limit
        .map(h => h.name)
  }, [holdings, selectedTicker, prefs])

  // 4. Fetch News
  const { data: newsData, isLoading: newsLoading } = useNews(searchQueries)

  // Handlers
  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault()
      if (customSearch.trim()) {
          setSelectedTicker(`SEARCH:${customSearch}`)
      }
  }

  const togglePreference = async (ticker: string, field: 'is_muted' | 'is_favorite') => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const existing = prefs?.[ticker] || { is_muted: false, is_favorite: false }
      const newValue = !existing[field]

      await supabase.from('news_settings').upsert({
          user_id: user.id,
          ticker,
          is_muted: existing.is_muted,
          is_favorite: existing.is_favorite,
          [field]: newValue,
      })

      queryClient.invalidateQueries({ queryKey: ['newsPreferences'] })
  }

  const handleSelectTicker = (ticker: string) => {
      setSelectedTicker(ticker)
  }

  // Helper for Header Text
  const getHeader = () => {
      if (selectedTicker === 'ALL') return { title: 'Market News', subtitle: 'Curated updates for your portfolio.' }
      if (selectedTicker === 'GENERAL') return { title: 'General Markets', subtitle: 'Global Economy, Commodities & Policy.' }
      if (selectedTicker.startsWith('SEARCH:')) return { title: `Search: "${selectedTicker.replace('SEARCH:', '')}"`, subtitle: 'Custom news feed.' }
      return { 
          title: holdings.find(h => h.ticker === selectedTicker)?.name || 'Asset News', 
          subtitle: 'Latest updates for this asset.' 
      }
  }

  const headerInfo = getHeader()

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6 relative">
        
        {/* SIDEBAR / FILTERS */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            
            {/* NEW: SEARCH BAR */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <form onSubmit={handleSearch} className="relative mb-3">
                    <input 
                        type="text" 
                        placeholder="Search news (e.g. Tesla)..." 
                        value={customSearch}
                        onChange={(e) => setCustomSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </form>
                
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                    <Filter className="h-3 w-3" /> Filter Sources
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* 1. GENERAL MARKETS BUTTON */}
                <button
                    onClick={() => handleSelectTicker('GENERAL')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedTicker === 'GENERAL' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                >
                    <Globe className="h-4 w-4" />
                    General Markets
                </button>

                {/* 2. SMART FEED BUTTON */}
                <button
                    onClick={() => handleSelectTicker('ALL')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedTicker === 'ALL' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                >
                    <Newspaper className="h-4 w-4" />
                    My Portfolio Feed
                </button>
                
                <div className="my-2 h-px bg-slate-100 dark:bg-slate-800 mx-2"></div>

                {/* 3. HOLDINGS LIST */}
                {holdings.map(h => {
                    const p = prefs?.[h.ticker] || { is_muted: false, is_favorite: false }
                    return (
                        <div key={h.ticker} className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${selectedTicker === h.ticker ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                            <button 
                                onClick={() => handleSelectTicker(h.ticker)}
                                className={`flex-1 text-left truncate text-sm ${p.is_muted ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700 dark:text-slate-300'}`}
                            >
                                {h.name}
                            </button>
                            
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); togglePreference(h.ticker, 'is_favorite'); }}
                                    className={`p-1.5 rounded-md transition-colors ${p.is_favorite ? 'text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-300 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <Star className={`h-3.5 w-3.5 ${p.is_favorite ? 'fill-current' : ''}`} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); togglePreference(h.ticker, 'is_muted'); }}
                                    className={`p-1.5 rounded-md transition-colors ${p.is_muted ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-300 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <BellOff className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>

        {/* RIGHT: News Feed */}
        <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {headerInfo.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {headerInfo.subtitle}
                </p>
            </div>

            {newsLoading ? (
                <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
            ) : !newsData?.items || newsData.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
                    <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No recent news found.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                    {newsData.items.map((item: any, i: number) => (
                        <a 
                            key={i} 
                            href={item.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-900"
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded dark:bg-indigo-900/30 dark:text-indigo-300">
                                        {item.sourceName}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(item.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-relaxed mb-2">
                                    {item.title}
                                </h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-indigo-600 dark:text-slate-400">
                                Read full story <ExternalLink className="h-3 w-3" />
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>

    </div>
  )
}