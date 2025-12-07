'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useTransactions, useNewsPreferences, useNews } from '@/hooks/use-portfolio-data'
import { Loader2, Star, BellOff, ExternalLink, Newspaper, Filter, Globe, Search, X, ChevronRight, Menu } from 'lucide-react'

// --- MACRO TOPICS LIST ---
const GENERAL_TOPICS = [
    "Indian Economy GDP",
    "RBI Monetary Policy Repo Rate",
    "India Inflation CPI WPI",
    "Indian Rupee vs Dollar",
    "India GST Collections",
    "India Manufacturing PMI",
    "FII DII Activity India",
    "US Federal Reserve Powell",
    "US Inflation CPI PCE Data",
    "US GDP Growth",
    "US Non-Farm Payrolls Jobs",
    "Global Recession Risks",
    "China Economic Stimulus",
    "Eurozone ECB Policy",
    "Bank of Japan Monetary Policy",
    "Bank of England Interest Rates",
    "Brent Crude Oil Price",
    "Gold Price Movement",
    "Silver Price Trends",
    "Copper Prices LME",
    "Natural Gas Prices",
    "Steel Prices India",
    "Lithium Battery Metal Prices",
    "US 10 Year Treasury Yield",
    "India 10 Year Bond Yield",
    "Global Bond Market Selloff",
    "Yield Curve Inversion",
    "Geopolitical Tensions Trade War",
    "OPEC Oil Production",
    "Global Supply Chain Crisis"
]

export default function NewsPage() {
  const [selectedTicker, setSelectedTicker] = useState<string>('ALL')
  const [customSearch, setCustomSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false) // <--- NEW STATE FOR MOBILE DRAWER
  
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

  // 4. Fetch News
  const { data: newsData, isLoading: newsLoading } = useNews(searchQueries)

  // Handlers
  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault()
      if (customSearch.trim()) {
          setSelectedTicker(`SEARCH:${customSearch}`)
          setIsSearching(true)
          setMobileMenuOpen(false) // Close menu on search
      }
  }

  const clearSearch = () => {
      setCustomSearch('')
      setIsSearching(false)
      setSelectedTicker('ALL')
  }

  const handleSelect = (ticker: string) => {
      setSelectedTicker(ticker)
      setCustomSearch('')
      setMobileMenuOpen(false) // Close menu on select
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
      if (selectedTicker === 'GENERAL') return { title: 'General Markets', subtitle: 'Global Economy, Commodities & Policy.' }
      if (selectedTicker.startsWith('SEARCH:')) return { title: `Results: "${selectedTicker.replace('SEARCH:', '')}"`, subtitle: 'Custom search feed.' }
      return { 
          title: holdings.find(h => h.ticker === selectedTicker)?.name || 'Asset News', 
          subtitle: 'Specific news for this asset.' 
      }
  }
  const headerInfo = getHeader()

  // --- REUSABLE FILTER LIST COMPONENT ---
  const FilterList = () => (
      <div className="space-y-1 p-2">
          <button onClick={() => handleSelect('ALL')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedTicker === 'ALL' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
              <Newspaper className="h-4 w-4" /> My Portfolio Feed
          </button>
          <button onClick={() => handleSelect('GENERAL')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedTicker === 'GENERAL' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
              <Globe className="h-4 w-4" /> General Markets
          </button>
          
          <div className="my-2 h-px bg-slate-100 dark:bg-slate-800 mx-2"></div>
          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Holdings</div>

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
  )

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6 relative">
        
        {/* --- DESKTOP SIDEBAR (Hidden on Mobile) --- */}
        <div className="hidden lg:flex w-80 flex-shrink-0 flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Filter Sources
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                <FilterList />
            </div>
        </div>

        {/* --- MOBILE FILTER DRAWER (Overlay) --- */}
        {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
                <div className="relative w-4/5 max-w-xs bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 dark:text-white">Select Source</h3>
                        <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <FilterList />
                    </div>
                </div>
            </div>
        )}

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
            
            {/* HEADER & CONTROLS */}
            <div className="flex flex-col gap-4 mb-4">
                
                {/* Search & Mobile Toggle Row */}
                <div className="flex gap-2">
                    {/* Filter Button (Mobile Only) */}
                    <button 
                        onClick={() => setMobileMenuOpen(true)}
                        className="lg:hidden p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-slate-600 dark:text-slate-300"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="relative flex-1">
                        <input 
                            type="text" 
                            placeholder="Search news (e.g. Adani)..." 
                            value={customSearch}
                            onChange={(e) => setCustomSearch(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        {isSearching && (
                            <button type="button" onClick={clearSearch} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </form>
                </div>

                {/* Title Section */}
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{headerInfo.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{headerInfo.subtitle}</p>
                </div>
            </div>

            {/* NEWS GRID */}
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