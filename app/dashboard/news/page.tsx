'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useTransactions, useNewsPreferences, useNews } from '@/hooks/use-portfolio-data'
import { Loader2, Star, BellOff, ExternalLink, Newspaper, Filter, Globe, Search, X, ChevronLeft, ArrowLeft } from 'lucide-react'

// --- MACRO TOPICS LIST ---
const GENERAL_TOPICS = [
    "Indian Economy GDP", "RBI Monetary Policy", "India Inflation CPI", "Nifty 50 Sensex", 
    "US Federal Reserve", "Brent Crude Oil", "Gold Price", "Global Recession", 
    "FII DII Activity", "India GST Collections", "Geopolitical Tensions"
]

export default function NewsPage() {
  const [selectedTicker, setSelectedTicker] = useState<string>('ALL')
  const [customSearch, setCustomSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  // MOBILE NAVIGATION STATE
  // false = Show Filter List, true = Show News Feed
  const [showFeed, setShowFeed] = useState(false) 
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: transactions } = useTransactions()
  const { data: prefs } = useNewsPreferences()

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
          const aPref = prefs?.[a.ticker] || { is_favorite: false, is_muted: false }
          const bPref = prefs?.[b.ticker] || { is_favorite: false, is_muted: false }
          if (aPref.is_favorite && !bPref.is_favorite) return -1
          if (!aPref.is_favorite && bPref.is_favorite) return 1
          return b.value - a.value
      })
  }, [transactions, prefs])

  const searchQueries = useMemo(() => {
      if (selectedTicker.startsWith('SEARCH:')) return [selectedTicker.replace('SEARCH:', '')]
      if (selectedTicker === 'GENERAL') return GENERAL_TOPICS
      if (selectedTicker !== 'ALL') {
          const asset = holdings.find(h => h.ticker === selectedTicker)
          return asset ? [asset.name] : []
      }
      return holdings
        .filter(h => {
            const p = prefs?.[h.ticker]
            if (p?.is_muted) return false 
            if (p?.is_favorite) return true 
            return true 
        })
        .slice(0, 15)
        .map(h => h.name)
  }, [holdings, selectedTicker, prefs])

  const { data: newsData, isLoading: newsLoading } = useNews(searchQueries)

  // HANDLERS
  const handleSelect = (ticker: string) => {
      setSelectedTicker(ticker)
      setCustomSearch('')
      setShowFeed(true) // <--- Go to Feed View on Mobile
  }

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault()
      if (customSearch.trim()) {
          setSelectedTicker(`SEARCH:${customSearch}`)
          setIsSearching(true)
          setShowFeed(true) // <--- Go to Feed View on Mobile
      }
  }

  const clearSearch = () => {
      setCustomSearch('')
      setIsSearching(false)
      setSelectedTicker('ALL')
  }

  const togglePreference = async (ticker: string, field: 'is_muted' | 'is_favorite') => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const existing = prefs?.[ticker] || { is_muted: false, is_favorite: false }
      const newValue = !existing[field]
      await supabase.from('news_settings').upsert({
          user_id: user.id, ticker,
          is_muted: existing.is_muted, is_favorite: existing.is_favorite,
          [field]: newValue,
      })
      queryClient.invalidateQueries({ queryKey: ['newsPreferences'] })
  }

  const getHeader = () => {
      if (selectedTicker === 'ALL') return { title: 'Smart Feed', subtitle: 'Curated updates for your portfolio.' }
      if (selectedTicker === 'GENERAL') return { title: 'General Markets', subtitle: 'Global Economy & Policy.' }
      if (selectedTicker.startsWith('SEARCH:')) return { title: `Results: "${selectedTicker.replace('SEARCH:', '')}"`, subtitle: 'Custom search feed.' }
      return { 
          title: holdings.find(h => h.ticker === selectedTicker)?.name || 'Asset News', 
          subtitle: 'Specific news for this asset.' 
      }
  }
  const headerInfo = getHeader()

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6 relative">
        
        {/* --- LEFT: FILTERS LIST (Sidebar) --- */}
        {/* Hidden on mobile if viewing feed, Always visible on desktop */}
        <div className={`
            w-full lg:w-80 flex-shrink-0 flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full
            ${showFeed ? 'hidden lg:flex' : 'flex'} 
        `}>
            
            {/* Search Bar (Now inside Sidebar for Mobile Context) */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-3">
                <form onSubmit={handleSearch} className="relative w-full">
                    <input 
                        type="text" 
                        placeholder="Search news..." 
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
                <button onClick={() => handleSelect('ALL')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedTicker === 'ALL' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                    <Newspaper className="h-4 w-4" /> My Portfolio Feed
                </button>
                <button onClick={() => handleSelect('GENERAL')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedTicker === 'GENERAL' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                    <Globe className="h-4 w-4" /> General Markets
                </button>
                
                <div className="my-2 h-px bg-slate-100 dark:bg-slate-800 mx-2"></div>
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Holdings</div>

                {holdings.map(h => {
                    const p = prefs?.[h.ticker] || { is_muted: false, is_favorite: false }
                    return (
                        <div key={h.ticker} className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${selectedTicker === h.ticker ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                            <button onClick={() => handleSelect(h.ticker)} className={`flex-1 text-left truncate text-sm ${p.is_muted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                {h.name}
                            </button>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); togglePreference(h.ticker, 'is_favorite'); }} className={`p-1.5 rounded-md ${p.is_favorite ? 'text-amber-400' : 'text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><Star className={`h-3.5 w-3.5 ${p.is_favorite ? 'fill-current' : ''}`} /></button>
                                <button onClick={(e) => { e.stopPropagation(); togglePreference(h.ticker, 'is_muted'); }} className={`p-1.5 rounded-md ${p.is_muted ? 'text-red-500' : 'text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><BellOff className="h-3.5 w-3.5" /></button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>

        {/* --- RIGHT: NEWS FEED (Main Content) --- */}
        {/* Hidden on mobile if NOT showing feed, Always visible on desktop */}
        <div className={`
            flex-1 flex-col min-w-0 h-full
            ${!showFeed ? 'hidden lg:flex' : 'flex'}
        `}>
            
            {/* Header Area */}
            <div className="flex flex-col gap-4 mb-4">
                
                {/* Mobile Back Button */}
                <button 
                    onClick={() => setShowFeed(false)}
                    className="lg:hidden flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 mb-2 dark:text-indigo-400"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Filters
                </button>

                {/* Title Section */}
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{headerInfo.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{headerInfo.subtitle}</p>
                </div>
            </div>

            {/* FEED GRID */}
            <div className="flex-1 overflow-y-auto pr-1">
                {newsLoading ? (
                    <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
                ) : !newsData?.items || newsData.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
                        <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p>No recent news found.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 pb-20">
                        {newsData.items.map((item: any, i: number) => (
                            <a 
                                key={i} 
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-900 group"
                            >
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded dark:bg-indigo-900/30 dark:text-indigo-300">
                                            {item.sourceName}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {new Date(item.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-relaxed mb-2 group-hover:text-indigo-600 transition-colors">
                                        {item.title}
                                    </h3>
                                </div>
                                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Read full story <ExternalLink className="h-3 w-3" />
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>

    </div>
  )
}