'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Trash2, Calendar, TrendingUp, TrendingDown, Loader2, Edit2, Save, XCircle, BarChart3, Microscope } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

type AssetDetailsDrawerProps = {
  asset: { ids: number[]; name: string; ticker: string } | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function AssetDetailsDrawer({ asset, isOpen, onClose, onUpdate }: AssetDetailsDrawerProps) {
  const { selectedPortfolio } = usePortfolio()
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  
  const [editQty, setEditQty] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDate, setEditDate] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (asset && isOpen) {
        fetchHistory()
    }
  }, [asset, isOpen, selectedPortfolio])

  const fetchHistory = async () => {
    if (!asset) return
    setLoading(true)

    try {
        let query = supabase
            .from('transactions')
            .select('*')
            .in('asset_id', asset.ids)
            .order('date', { ascending: false })

        if (selectedPortfolio && selectedPortfolio.id !== 'all') {
            query = query.eq('portfolio_id', selectedPortfolio.id)
        }

        const { data, error } = await query

        if (error) {
            console.error("Error fetching transactions:", error.message)
            setTransactions([])
        } else {
            setTransactions(data || [])
        }

    } catch (e: any) {
        console.error("Critical Error:", e.message)
    } finally {
        setLoading(false)
    }
  }

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
            
            {/* ULTIMATE ANALYSIS BUTTON */}
            {!asset.ticker.startsWith('COMMODITY:') && (
                <button
                    onClick={() => {
                        onClose()
                        router.push(`/dashboard/holdings/analysis/${encodeURIComponent(asset.ticker)}`)
                    }}
                    className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-700 hover:to-violet-700 transition shadow-lg shadow-indigo-600/20"
                >
                    <Microscope className="h-4 w-4" />
                    Ultimate Analysis
                </button>
            )}

            {/* TRANSACTIONS */}
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BarChart3 className="h-3 w-3" /> Transaction History
            </h3>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
            ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-100 rounded-xl dark:border-slate-800">
                    <p className="text-slate-400 text-sm">No transactions found for this portfolio.</p>
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