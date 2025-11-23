// components/asset-details-drawer.tsx
'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, Calendar, TrendingUp, TrendingDown, Loader2, Edit2, Save, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AssetDetailsDrawerProps = {
  // CHANGED: Now accepts an array of IDs to handle merged assets (NSE + BSE)
  asset: { ids: number[]; name: string; ticker: string } | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function AssetDetailsDrawer({ asset, isOpen, onClose, onUpdate }: AssetDetailsDrawerProps) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  
  // Edit Form State
  const [editQty, setEditQty] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDate, setEditDate] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (asset && isOpen) fetchHistory()
  }, [asset, isOpen])

  const fetchHistory = async () => {
    if (!asset) return
    setLoading(true)
    
    // CHANGED: Fetch transactions for ALL IDs associated with this stock (e.g. NSE & BSE IDs)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .in('asset_id', asset.ids) // <--- The magic fix
      .order('date', { ascending: false })
      
    setTransactions(data || [])
    setLoading(false)
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
            .update({ 
                quantity: Number(editQty), 
                price: Number(editPrice), 
                date: editDate,
            })
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
        fetchHistory()
        onUpdate()
    }
  }

  const inputClass = "w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"

  if (!isOpen || !asset) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{asset.name}</h2>
            <p className="text-sm text-slate-500">{asset.ticker}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white hover:shadow-sm transition">
            <X className="h-6 w-6 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-slate-400">No transactions found.</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((txn) => (
                <div key={txn.id} className={`rounded-lg border p-4 transition ${editingId === txn.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-white'}`}>
                  
                  {/* EDIT MODE */}
                  {editingId === txn.id ? (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <div className="w-1/2">
                                <label className="text-xs text-slate-500 mb-1 block">Qty</label>
                                <input 
                                    type="number" 
                                    value={editQty} 
                                    onChange={e => setEditQty(e.target.value)} 
                                    className={inputClass} 
                                />
                            </div>
                            <div className="w-1/2">
                                <label className="text-xs text-slate-500 mb-1 block">Price</label>
                                <input 
                                    type="number" 
                                    value={editPrice} 
                                    onChange={e => setEditPrice(e.target.value)} 
                                    className={inputClass} 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Date</label>
                            <input 
                                type="date" 
                                value={editDate} 
                                onChange={e => setEditDate(e.target.value)} 
                                className={inputClass} 
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setEditingId(null)} className="flex items-center gap-1 rounded px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"><XCircle className="h-3 w-3"/> Cancel</button>
                            <button onClick={() => handleSaveEdit(txn.id)} className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"><Save className="h-3 w-3"/> Save</button>
                        </div>
                    </div>
                  ) : (
                    /* VIEW MODE */
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`rounded-full p-2 ${txn.transaction_type === 'Buy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {txn.transaction_type === 'Buy' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {txn.transaction_type} <span className="text-slate-500">{txn.quantity} @ ₹{txn.price}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {txn.date}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button onClick={() => handleStartEdit(txn)} className="p-2 text-slate-400 hover:text-indigo-600 transition" title="Edit"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(txn.id)} className="p-2 text-slate-400 hover:text-red-600 transition" title="Delete"><Trash2 className="h-4 w-4" /></button>
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