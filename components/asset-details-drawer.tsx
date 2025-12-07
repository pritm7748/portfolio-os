'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, Calendar, TrendingUp, TrendingDown, Loader2, Edit2, Save, XCircle, Activity, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

type AssetDetailsDrawerProps = {
  asset: { ids: number[]; name: string; ticker: string } | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

type Fundamentals = {
    marketCap: number
    peRatio: number
    high52: number
    low52: number
    divYield: number
    currency: string
}

export default function AssetDetailsDrawer({ asset, isOpen, onClose, onUpdate }: AssetDetailsDrawerProps) {
  const { selectedPortfolio } = usePortfolio()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [stats, setStats] = useState<Fundamentals | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  
  // Edit States
  const [editQty, setEditQty] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDate, setEditDate] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (asset && isOpen) {
        // Run the robust fetcher
        fetchHistory()
        
        // Fetch fundamentals
        if (!asset.ticker.startsWith('COMMODITY:')) {
            fetchFundamentals(asset.ticker)
        } else {
            setStats(null)
        }
    }
  }, [asset, isOpen, selectedPortfolio])

  const fetchHistory = async () => {
    if (!asset) return
    setLoading(true)
    console.log(`[Drawer] Opening for: ${asset.ticker} | Portfolio: ${selectedPortfolio?.id}`)

    try {
        // STRATEGY: Fetch ALL transactions for this ticker string, then filter in JS.
        // This bypasses any complex DB relationship issues.
        
        // 1. Find all Asset IDs that match this ticker text (e.g. "TCS" or "TCS.NS")
        // We use 'ilike' to be case-insensitive and handle variations
        const { data: matchingAssets, error: assetError } = await supabase
            .from('assets')
            .select('id, ticker, portfolio_id')
            .ilike('ticker', asset.ticker) 

        if (assetError) throw assetError
        
        console.log("[Drawer] Matching Assets found in DB:", matchingAssets)

        if (!matchingAssets || matchingAssets.length === 0) {
            console.warn("[Drawer] No assets found in DB matching ticker:", asset.ticker)
            setTransactions([])
            setLoading(false)
            return
        }

        // 2. Extract valid IDs
        const allAssetIds = matchingAssets.map(a => a.id)

        // 3. Fetch Transactions for ALL these IDs
        const { data: allTxns, error: txnError } = await supabase
            .from('transactions')
            .select(`
                *,
                assets (
                    id,
                    ticker,
                    portfolio_id
                )
            `)
            .in('asset_id', allAssetIds)
            .order('date', { ascending: false })

        if (txnError) throw txnError

        console.log("[Drawer] Raw Transactions Fetched:", allTxns)

        // 4. FILTERING LOGIC
        // We filter manually to ensure complete control
        let finalTxns = allTxns || []

        if (selectedPortfolio && selectedPortfolio.id !== 'all') {
            finalTxns = finalTxns.filter((t: any) => {
                // Check if the transaction's parent asset belongs to the selected portfolio
                // We use "==" for loose equality (string '1' == number 1)
                const belongsToPortfolio = t.assets?.portfolio_id == selectedPortfolio.id
                return belongsToPortfolio
            })
        }

        console.log("[Drawer] Final Filtered Transactions:", finalTxns)
        setTransactions(finalTxns)

    } catch (e: any) {
        console.error("[Drawer] Critical Error:", e.message)
        alert("Error fetching data. Check console for details.")
    } finally {
        setLoading(false)
    }
  }

  const fetchFundamentals = async (ticker: string) => {
      setLoadingStats(true)
      try {
        const res = await fetch('/api/quote', {
            method: 'POST',
            body: JSON.stringify({ ticker })
        })
        if (res.ok) {
            const data = await res.json()
            setStats(data)
        }
      } catch (e) {
          console.error(e)
      } finally {
          setLoadingStats(false)
      }
  }

  // --- HANDLERS ---
  const handleStartEdit = (txn: any) => {
    setEditingId(txn.id)
    setEditQty(txn.quantity)
    setEditPrice(txn.price)
    setEditDate(txn.date.split('T')[0]) 
  }

  const handleSaveEdit = async (id: number) => {
    try {
        const { error } = await supabase
            .from('transactions')
            .update({ quantity: Number(editQty), price: Number(editPrice), date: editDate })
            .eq('id', id)
        if (error) throw error
        setEditingId(null)
        fetchHistory()
        onUpdate()
    } catch (e: any) {
        alert("Update failed: " + e.message)
    }
  }

  const handleDelete = async (txnId: number) => {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', txnId)
    if (!error) {
        const remaining = transactions.filter(t => t.id !== txnId)
        setTransactions(remaining)
        onUpdate() 
        if (remaining.length === 0) onClose()
        else fetchHistory()
    }
  }

  const formatMarketCap = (num: number) => {
      if (!num) return '-'
      if (num >= 10000000) return (num / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + " Cr"
      if (num >= 100000) return (num / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + " L"
      return num.toLocaleString('en-IN')
  }

  const inputClass = "w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"

  if (!isOpen || !asset) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden dark:bg-slate-900 animate-in slide-in-from-right duration-300">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{asset.name}</h2>
            <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {asset.ticker}
                </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white hover:shadow-sm transition dark:hover:bg-slate-800">
            <X className="h-6 w-6 text-slate-500" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            
            {/* FUNDAMENTALS */}
            {!asset.ticker.startsWith('COMMODITY:') && (
                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:bg-slate-800/50 dark:border-slate-700">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Activity className="h-3 w-3" /> Fundamentals
                    </h3>
                    {loadingStats ? (
                        <div className="h-24 animate-pulse bg-slate-200 rounded dark:bg-slate-700"></div>
                    ) : stats ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Market Cap</p>
                                <p className="font-semibold text-slate-900 dark:text-white">₹{formatMarketCap(stats.marketCap)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">P/E Ratio</p>
                                <p className="font-semibold text-slate-900 dark:text-white">{stats.peRatio > 0 ? stats.peRatio.toFixed(2) : 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">52W High / Low</p>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                    {stats.high52?.toFixed(0)} / {stats.low52?.toFixed(0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Div Yield</p>
                                <p className="font-semibold text-green-600 dark:text-green-400">{(stats.divYield * 100).toFixed(2)}%</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Data unavailable for this asset.</p>
                    )}
                </div>
            )}

            {/* TRANSACTIONS */}
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BarChart3 className="h-3 w-3" /> Transaction History
            </h3>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
            ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-100 rounded-xl dark:border-slate-800">
                    <p className="text-slate-400 text-sm">No transactions found.</p>
                    <p className="text-xs text-slate-300 mt-2 max-w-[200px]">
                        Debugging: Check console (F12) to see raw data fetch details.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                {transactions.map((txn) => (
                    <div key={txn.id} className={`rounded-lg border p-4 transition ${editingId === txn.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800'}`}>
                    
                    {/* EDIT MODE */}
                    {editingId === txn.id ? (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <div className="w-1/2">
                                    <label className="text-xs text-slate-500 mb-1 block">Qty</label>
                                    <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} className={inputClass} />
                                </div>
                                <div className="w-1/2">
                                    <label className="text-xs text-slate-500 mb-1 block">Price</label>
                                    <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className={inputClass} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Date</label>
                                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputClass} />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setEditingId(null)} className="flex items-center gap-1 rounded px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"><XCircle className="h-3 w-3"/> Cancel</button>
                                <button onClick={() => handleSaveEdit(txn.id)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"><Save className="h-3 w-3"/> Save</button>
                            </div>
                        </div>
                    ) : (
                        /* VIEW MODE */
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className={`rounded-full p-2 ${txn.transaction_type === 'Buy' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {txn.transaction_type === 'Buy' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                        {txn.transaction_type} <span className="text-slate-500 dark:text-slate-400">{txn.quantity} @ ₹{txn.price}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(txn.date).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button onClick={() => handleStartEdit(txn)} className="p-2 text-slate-400 hover:text-indigo-600 transition dark:hover:text-indigo-400" title="Edit"><Edit2 className="h-4 w-4" /></button>
                                <button onClick={() => handleDelete(txn.id)} className="p-2 text-slate-400 hover:text-red-600 transition dark:hover:text-red-400" title="Delete"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </div>
                    )}
                    </div>
                ))}
                </div>
            )}
        </div>
      </div>
    </div>
  )
}