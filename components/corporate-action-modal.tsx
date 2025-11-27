// components/corporate-action-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Scissors, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type SearchResult = { symbol: string; name: string; type: string; exch: string }

export default function CorporateActionModal({ isOpen, onClose, onSuccess }: Props) {
  const { selectedPortfolio, portfolios } = usePortfolio()
  const [loading, setLoading] = useState(false)
  
  // Form States
  const [targetPortfolioId, setTargetPortfolioId] = useState<number>(0)
  const [ticker, setTicker] = useState('')
  const [assetName, setAssetName] = useState('')
  const [type, setType] = useState<'Split' | 'Bonus'>('Split')
  const [ratioA, setRatioA] = useState('10') // "10" for 1
  const [ratioB, setRatioB] = useState('1')
  const [exDate, setExDate] = useState(new Date().toISOString().split('T')[0])
  
  // Search States
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (isOpen && portfolios.length > 0) {
        if (selectedPortfolio.id !== 'all') setTargetPortfolioId(selectedPortfolio.id as number)
        else setTargetPortfolioId(portfolios[0].id as number)
    }
  }, [isOpen, selectedPortfolio, portfolios])

  // Search Logic (Reused)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (ticker.length > 2 && showResults) {
        setSearching(true)
        try {
            const res = await fetch(`/api/search?q=${ticker}`)
            const data = await res.json()
            setResults(data)
        } catch (e) { console.error(e) } 
        finally { setSearching(false) }
      } else if (ticker.length === 0) {
        setResults([])
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [ticker, showResults])

  const handleSelectAsset = (item: SearchResult) => {
    setTicker(item.symbol)
    setAssetName(item.name)
    setShowResults(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirm(`This will adjust ALL historical transactions for ${ticker} before ${exDate}. This cannot be undone easily. Proceed?`)) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // 1. Find Asset ID
      const { data: assetData } = await supabase
        .from('assets')
        .select('id')
        .eq('ticker', ticker)
        .single()
      
      if (!assetData) throw new Error('Asset not found in database. Add a transaction first.')

      // 2. Calculate Adjustment Factor
      // Split 10:1 means "10 new for 1 old" -> Factor = 10
      // Bonus 1:1 means "1 bonus for 1 old" -> Total 2 -> Factor = 2
      // Bonus 2:1 means "2 bonus for 1 old" -> Total 3 -> Factor = 3
      
      let factor = 1
      const rA = Number(ratioA)
      const rB = Number(ratioB)

      if (type === 'Split') {
          factor = rA / rB // e.g. 10/1 = 10
      } else {
          // Bonus: (Existing + Bonus) / Existing
          factor = (rB + rA) / rB
      }

      if (isNaN(factor) || factor <= 0) throw new Error('Invalid Ratio')

      // 3. Fetch Affected Transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('asset_id', assetData.id)
        .eq('portfolio_id', targetPortfolioId)
        .lt('date', exDate) // Only transactions BEFORE Ex-Date

      if (!transactions || transactions.length === 0) throw new Error('No transactions found before this date.')

      // 4. Update Each Transaction
      for (const txn of transactions) {
          const newQty = Number(txn.quantity) * factor
          const newPrice = Number(txn.price) / factor
          
          // Update Buy/Sell Records
          await supabase
            .from('transactions')
            .update({
                quantity: newQty,
                price: newPrice,
                // Note: total_value stays roughly the same, but we let DB/Logic handle it
            })
            .eq('id', txn.id)
      }

      alert(`Success! Adjusted ${transactions.length} transactions by factor ${factor.toFixed(2)}x`)
      onSuccess()
      onClose()
      
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white"

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
        
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <Scissors className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Corporate Action</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-6 w-6 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Ticker Search */}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ticker</label>
            <div className="relative">
                <input 
                    required type="text" placeholder="Search Asset..." 
                    value={ticker}
                    onChange={(e) => { setTicker(e.target.value); setShowResults(true) }}
                    className={`${inputClass} pl-9`}
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                {searching && <div className="absolute right-3 top-2.5"><Loader2 className="h-4 w-4 animate-spin text-indigo-600" /></div>}
            </div>
            {showResults && results.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:bg-slate-900 dark:border-slate-700">
                    {results.map((item) => (
                        <li key={item.symbol} onClick={() => handleSelectAsset(item)} className="cursor-pointer px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800">
                            <div className="font-bold text-slate-900 dark:text-white">{item.symbol}</div>
                            <div className="flex justify-between text-xs text-slate-500"><span>{item.name}</span></div>
                        </li>
                    ))}
                </ul>
            )}
          </div>

          {/* Type Selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Action Type</label>
            <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" onClick={() => setType('Split')} className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${type === 'Split' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>Stock Split</button>
                <button type="button" onClick={() => setType('Bonus')} className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${type === 'Bonus' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>Bonus Issue</button>
            </div>
          </div>

          {/* Ratio Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {type === 'Split' ? 'New Shares' : 'Bonus Shares'}
                </label>
                <input type="number" value={ratioA} onChange={(e) => setRatioA(e.target.value)} className={inputClass} />
            </div>
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {type === 'Split' ? 'For Old Shares' : 'For Every Held'}
                </label>
                <input type="number" value={ratioB} onChange={(e) => setRatioB(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Ex-Date */}
          <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ex-Date (Cutoff)</label>
              <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-slate-500">Only transactions BEFORE this date will be adjusted.</p>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Processing...' : 'Apply Adjustment'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}