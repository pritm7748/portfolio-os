'use client'

import { useState, useEffect } from 'react'
import { Search, Trash2, Loader2, Plus, X, Bell, Info } from 'lucide-react' // Added Info
import { createClient } from '@/lib/supabase/client'
import AlertModal from '@/components/alert-modal'

type WatchlistItem = {
  id: number
  ticker: string
  name: string
  type: string
  livePrice: number
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  
  const [alertAsset, setAlertAsset] = useState<{ticker: string, price: number} | null>(null)
  
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const supabase = createClient()

  const fetchWatchlist = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('watchlist').select('*').order('created_at', { ascending: false })
    if (error || !data) { setLoading(false); return }

    const tickers = data.map(d => d.ticker)
    if (tickers.length > 0) {
        try {
            const res = await fetch('/api/prices', { method: 'POST', body: JSON.stringify({ tickers }) })
            const priceMap = await res.json()
            
            const merged = data.map(d => {
                let clean = d.ticker.toUpperCase().replace(/\s/g, '')
                let price = 0
                const foundKey = Object.keys(priceMap).find(k => k.includes(clean.split('.')[0]))
                if (foundKey) price = priceMap[foundKey]
                return { ...d, livePrice: price }
            })
            setItems(merged)
        } catch (e) { console.error(e) }
    } else { setItems([]) }
    setLoading(false)
  }

  useEffect(() => { fetchWatchlist() }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
        if (query.length > 2) {
            setIsSearching(true)
            const res = await fetch(`/api/search?q=${query}`)
            const data = await res.json()
            setSearchResults(data)
            setIsSearching(false)
        } else { setSearchResults([]) }
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  const addToWatchlist = async (item: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const exists = items.find(i => i.ticker === item.symbol)
    if (exists) { alert('Already in watchlist'); setQuery(''); return }
    await supabase.from('watchlist').insert({ user_id: user.id, ticker: item.symbol, name: item.name, asset_type: item.type })
    setQuery(''); setSearchResults([]); fetchWatchlist()
  }

  const removeItem = async (id: number) => {
    await supabase.from('watchlist').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Watchlist</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track assets you are interested in.</p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <div className="relative">
            <input 
                type="text"
                placeholder="Search to add (e.g. Tesla, MRF)..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500"
            />
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            
            {query && !isSearching && (
                <button onClick={() => { setQuery(''); setSearchResults([]); }} className="absolute right-3 top-3.5 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                    <X className="h-3 w-3" />
                </button>
            )}
            {isSearching && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-indigo-600" />}
        </div>

        {searchResults.length > 0 && (
            <ul className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:bg-slate-900 dark:border-slate-800">
                {searchResults.map((result) => (
                    <li key={result.symbol} onClick={() => addToWatchlist(result)} className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800">
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">{result.symbol}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{result.name}</div>
                        </div>
                        <Plus className="h-4 w-4 text-indigo-600" />
                    </li>
                ))}
            </ul>
        )}

        {/* DISCLAIMER */}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="h-3 w-3 text-amber-500" />
            <span>Select tickers ending in <b>.NS</b> or <b>.BO</b> for Indian stocks.</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        {loading ? (
             <div className="flex h-40 items-center justify-center text-slate-500 dark:text-slate-400"><Loader2 className="h-6 w-6 animate-spin text-indigo-600"/></div>
        ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <p>Your watchlist is empty.</p>
            </div>
        ) : (
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                        <th className="px-6 py-4 font-medium">Asset</th>
                        <th className="px-6 py-4 font-medium text-right">Live Price</th>
                        <th className="px-6 py-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition group dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{item.ticker}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                    {item.livePrice > 0 ? `₹${item.livePrice.toLocaleString('en-IN')}` : 'Loading...'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => setAlertAsset({ ticker: item.ticker, price: item.livePrice })}
                                        className="p-2 text-slate-400 hover:text-indigo-600 transition dark:text-slate-500 dark:hover:text-indigo-400"
                                        title="Set Alert"
                                    >
                                        <Bell className="h-4 w-4" />
                                    </button>
                                    
                                    <button onClick={() => removeItem(item.id)} className="p-2 text-slate-400 hover:text-red-600 transition dark:text-slate-500 dark:hover:text-red-400">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>

      {alertAsset && (
        <AlertModal 
            isOpen={!!alertAsset} 
            onClose={() => setAlertAsset(null)} 
            ticker={alertAsset.ticker} 
            currentPrice={alertAsset.price} 
        />
      )}

    </div>
  )
}