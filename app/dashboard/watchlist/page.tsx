'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, Trash2, Loader2, Plus, Bell, Folder, Edit2, Check, X, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AlertModal from '@/components/alert-modal'
import { useWatchlists, useWatchlist, useLivePrices } from '@/hooks/use-portfolio-data'
import { useQueryClient } from '@tanstack/react-query'

export default function WatchlistPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // --- STATE ---
  const { data: watchlists } = useWatchlists()
  const [activeListId, setActiveListId] = useState<number | null>(null)
  
  // UI States
  const [isCreating, setIsCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  
  // Rename States
  const [editingListId, setEditingListId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  // Search & Alerts
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [alertAsset, setAlertAsset] = useState<{ticker: string, price: number} | null>(null)

  // Set default list on load (Selects first available list)
  useEffect(() => {
      if (watchlists && watchlists.length > 0 && !activeListId) {
          setActiveListId(watchlists[0].id)
      } else if (watchlists && watchlists.length > 0 && activeListId) {
          // Verify active list still exists
          const exists = watchlists.find(w => w.id === activeListId)
          if (!exists) setActiveListId(watchlists[0].id)
      }
  }, [watchlists, activeListId])

  // Fetch Items & Prices
  const { data: watchlistItems, isLoading: itemsLoading } = useWatchlist(activeListId || undefined)
  
  const tickers = useMemo(() => watchlistItems ? watchlistItems.map(i => i.ticker) : [], [watchlistItems])
  const { data: priceMap } = useLivePrices(tickers)

  const mergedItems = useMemo(() => {
      if (!watchlistItems) return []
      return watchlistItems.map(item => {
          const clean = item.ticker.toUpperCase().replace(/\s/g, '')
          let price = 0
          if (priceMap) {
              const foundKey = Object.keys(priceMap).find(k => k.includes(clean.split('.')[0]))
              if (foundKey) price = priceMap[foundKey].price
          }
          return { ...item, livePrice: price || 0 }
      })
  }, [watchlistItems, priceMap])

  // --- ACTIONS ---

  const handleSearch = async (val: string) => {
      setQuery(val)
      if (val.length > 2) {
          setIsSearching(true)
          try {
            const res = await fetch(`/api/search?q=${val}`)
            const data = await res.json()
            setSearchResults(data)
          } catch(e) { console.error(e) }
          finally { setIsSearching(false) }
      } else { setSearchResults([]) }
  }

  const clearSearch = () => {
      setQuery('')
      setSearchResults([])
      setIsSearching(false)
  }

  const addToWatchlist = async (item: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !activeListId) return
      
      const exists = watchlistItems?.find(i => i.ticker === item.symbol)
      if (exists) { alert('Already in this watchlist'); clearSearch(); return }

      await supabase.from('watchlist').insert({ 
          user_id: user.id, 
          watchlist_id: activeListId, 
          ticker: item.symbol, 
          name: item.name, 
          asset_type: item.type 
      })
      
      queryClient.invalidateQueries({ queryKey: ['watchlist', activeListId] })
      clearSearch()
  }

  // --- LIST MANAGEMENT ---

  const createNewList = async () => {
      if (!newListName.trim()) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('watchlists').insert({ user_id: user.id, name: newListName })
      queryClient.invalidateQueries({ queryKey: ['watchlists_groups'] })
      setIsCreating(false); setNewListName('')
  }

  const startRenaming = (e: React.MouseEvent, id: number, currentName: string) => {
      e.stopPropagation()
      setEditingListId(id)
      setEditingName(currentName)
  }

  const saveRename = async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      if (!editingName.trim() || !editingListId) return

      await supabase.from('watchlists').update({ name: editingName }).eq('id', editingListId)
      queryClient.invalidateQueries({ queryKey: ['watchlists_groups'] })
      setEditingListId(null)
  }

  const deleteList = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation()
      // Simplified confirmation
      if (!confirm("Delete this watchlist?")) return
      
      await supabase.from('watchlists').delete().eq('id', id)
      
      // If deleting the active list, nullify selection so useEffect picks a new one
      if (activeListId === id) setActiveListId(null)
      
      queryClient.invalidateQueries({ queryKey: ['watchlists_groups'] })
  }

  const removeItem = async (id: number) => {
      await supabase.from('watchlist').delete().eq('id', id)
      queryClient.invalidateQueries({ queryKey: ['watchlist', activeListId] })
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
      
      {/* --- SIDEBAR: WATCHLISTS --- */}
      <div className="w-full lg:w-64 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">My Lists</h3>
              <button onClick={() => setIsCreating(true)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><Plus className="h-4 w-4"/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              
              {/* CREATE NEW INPUT */}
              {isCreating && (
                  <div className="p-2 mb-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-slate-700">
                      <input 
                        autoFocus 
                        className="w-full text-sm border-b border-indigo-200 bg-transparent px-1 py-1 mb-2 outline-none dark:text-white dark:border-slate-600" 
                        placeholder="List Name..." 
                        value={newListName} 
                        onChange={e => setNewListName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && createNewList()}
                      />
                      <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
                          <button onClick={createNewList} className="text-indigo-600 font-bold hover:text-indigo-700">Save</button>
                      </div>
                  </div>
              )}

              {/* LIST OF WATCHLISTS */}
              {watchlists?.map(list => {
                  const isEditing = editingListId === list.id
                  const isActive = activeListId === list.id

                  return (
                    <div 
                        key={list.id} 
                        onClick={() => !isEditing && setActiveListId(list.id)}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm font-medium
                            ${isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}
                        `}
                    >
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <Folder className={`h-4 w-4 flex-shrink-0 ${isActive ? 'fill-indigo-200 dark:fill-indigo-900' : ''}`} />
                            
                            {/* RENAME INPUT vs NAME */}
                            {isEditing ? (
                                <form 
                                    onSubmit={saveRename} 
                                    onClick={e => e.stopPropagation()} 
                                    className="flex-1 flex items-center"
                                >
                                    <input 
                                        autoFocus
                                        className="w-full bg-white dark:bg-slate-900 border border-indigo-300 rounded px-1 py-0.5 text-xs outline-none text-slate-900 dark:text-white"
                                        value={editingName}
                                        onChange={e => setEditingName(e.target.value)}
                                        onBlur={() => saveRename()}
                                    />
                                </form>
                            ) : (
                                <span className="truncate">{list.name}</span>
                            )}
                        </div>

                        {/* ACTION BUTTONS (Rename / Delete) - UNLOCKED FOR ALL LISTS */}
                        {!isEditing && (
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => startRenaming(e, list.id, list.name)} className="p-1 hover:text-indigo-500 rounded"><Edit2 className="h-3 w-3" /></button>
                                <button onClick={(e) => deleteList(list.id, e)} className="p-1 hover:text-red-500 rounded"><Trash2 className="h-3 w-3" /></button>
                            </div>
                        )}
                        {isEditing && (
                            <button onClick={(e) => { e.stopPropagation(); saveRename(); }} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="h-3 w-3" /></button>
                        )}
                    </div>
                  )
              })}
          </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0">
          
          {/* SEARCH */}
          <div className="relative mb-2 z-20">
            <div className="relative">
                <input 
                    type="text"
                    placeholder={`Add to ${watchlists?.find(w => w.id === activeListId)?.name || 'watchlist'}...`}
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm shadow-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                />
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                
                {/* Clear (X) Button */}
                {query && !isSearching && (
                    <button 
                        onClick={clearSearch}
                        className="absolute right-3 top-3.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}

                {isSearching && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-indigo-600" />}
            </div>

            {/* Helper Text */}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
                <Info className="h-3 w-3 text-amber-500" />
                <span>Select tickers ending in <b>.NS</b> or <b>.BO</b> for Indian stocks.</span>
            </p>

            {searchResults.length > 0 && (
                <ul className="absolute mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:bg-slate-900 dark:border-slate-800">
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
          </div>

          {/* TABLE */}
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col mt-2">
            {itemsLoading ? (
                 <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>
            ) : mergedItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <p>This list is empty.</p>
                    <p className="text-xs mt-1">Use the search bar above to add assets.</p>
                </div>
            ) : (
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-medium">Asset</th>
                                <th className="px-6 py-4 font-medium text-right">Price</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {mergedItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{item.ticker}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{item.name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-mono font-medium text-slate-900 dark:text-white">
                                            {item.livePrice > 0 ? `₹${item.livePrice.toLocaleString('en-IN')}` : '---'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => setAlertAsset({ ticker: item.ticker, price: item.livePrice })}
                                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                            >
                                                <Bell className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => removeItem(item.id)} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
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