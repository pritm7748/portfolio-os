'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useTransactions, useNewsPreferences, useNews } from '@/hooks/use-portfolio-data'
import { Loader2, Star, BellOff, ExternalLink, Newspaper, Filter } from 'lucide-react'

export default function NewsPage() {
  const [selectedTicker, setSelectedTicker] = useState<string | 'ALL'>('ALL')
  const supabase = createClient()
  const queryClient = useQueryClient()

  // 1. Fetch Data
  const { data: transactions } = useTransactions()
  const { data: prefs } = useNewsPreferences()

  // 2. Process Holdings List (Unique & Sorted by Preference + Value)
  const holdings = useMemo(() => {
      if (!transactions) return []
      
      const map: Record<string, { name: string, value: number }> = {}
      transactions.forEach(t => {
          const val = t.transaction_type === 'Buy' ? (t.price * t.quantity) : -(t.price * t.quantity)
          if (!map[t.assets.ticker]) map[t.assets.ticker] = { name: t.assets.name, value: 0 }
          map[t.assets.ticker].value += val
      })

      const list = Object.entries(map).map(([ticker, data]) => ({ ticker, ...data }))

      // --- SORTING LOGIC ---
      // 1. Favorites (Top)
      // 2. Normal (Middle - Sorted by Value)
      // 3. Muted (Bottom)
      return list.sort((a, b) => {
          const aPref = prefs?.[a.ticker] || { is_favorite: false, is_muted: false }
          const bPref = prefs?.[b.ticker] || { is_favorite: false, is_muted: false }

          // Priority 1: Favorites
          if (aPref.is_favorite && !bPref.is_favorite) return -1
          if (!aPref.is_favorite && bPref.is_favorite) return 1

          // Priority 3: Muted (Push to bottom)
          if (aPref.is_muted && !bPref.is_muted) return 1
          if (!aPref.is_muted && bPref.is_muted) return -1

          // Priority 2: Value (High to Low)
          return b.value - a.value
      })
  }, [transactions, prefs])

  // 3. Build Query List for API
  const searchQueries = useMemo(() => {
      if (selectedTicker !== 'ALL') {
          const asset = holdings.find(h => h.ticker === selectedTicker)
          return asset ? [asset.name] : []
      }

      // "ALL" Mode: Smart Feed
      // Include: Favorites + Top Holdings (excluding muted)
      return holdings
        .filter(h => {
            const p = prefs?.[h.ticker]
            if (p?.is_muted) return false // Skip muted
            if (p?.is_favorite) return true // Always include favorites
            return true 
        })
        .slice(0, 10) // Limit to top 10 relevant
        .map(h => h.name)
  }, [holdings, selectedTicker, prefs])

  // 4. Fetch News
  const { data: newsData, isLoading: newsLoading } = useNews(searchQueries)

  // Handlers
  const togglePreference = async (ticker: string, field: 'is_muted' | 'is_favorite') => {
      const current = prefs?.[ticker]?.[field] || false
      const newValue = !current
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const existing = prefs?.[ticker] || { is_muted: false, is_favorite: false }

      await supabase.from('news_settings').upsert({
          user_id: user.id,
          ticker,
          is_muted: existing.is_muted,
          is_favorite: existing.is_favorite,
          [field]: newValue,
      })

      queryClient.invalidateQueries({ queryKey: ['newsPreferences'] })
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6">
        
        {/* LEFT: Sidebar / Filters */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Filter Sources
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <button
                    onClick={() => setSelectedTicker('ALL')}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${selectedTicker === 'ALL' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                >
                    Smart Feed (Top & Favorites)
                </button>
                
                <div className="my-2 h-px bg-slate-100 dark:bg-slate-800 mx-2"></div>

                {holdings.map(h => {
                    const p = prefs?.[h.ticker] || { is_muted: false, is_favorite: false }
                    
                    return (
                        <div key={h.ticker} className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${selectedTicker === h.ticker ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                            <button 
                                onClick={() => setSelectedTicker(h.ticker)}
                                className={`flex-1 text-left truncate text-sm ${p.is_muted ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700 dark:text-slate-300'}`}
                            >
                                {h.name}
                            </button>
                            
                            {/* Icons always visible now */}
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); togglePreference(h.ticker, 'is_favorite'); }}
                                    className={`p-1.5 rounded-md transition-colors ${p.is_favorite ? 'text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-300 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    title="Favorite"
                                >
                                    <Star className={`h-3.5 w-3.5 ${p.is_favorite ? 'fill-current' : ''}`} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); togglePreference(h.ticker, 'is_muted'); }}
                                    className={`p-1.5 rounded-md transition-colors ${p.is_muted ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-300 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    title={p.is_muted ? "Unmute" : "Mute"}
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
            {/* Page Header Removed as requested */}

            {newsLoading ? (
                <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
            ) : !newsData?.items || newsData.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
                    <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No recent news found for these assets.</p>
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