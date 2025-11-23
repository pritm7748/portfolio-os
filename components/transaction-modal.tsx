// components/transaction-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

type TransactionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type SearchResult = { symbol: string; name: string; type: string; exch: string }

export default function TransactionModal({ isOpen, onClose, onSuccess }: TransactionModalProps) {
  const { selectedPortfolio, portfolios, refreshPortfolios } = usePortfolio()
  const [loading, setLoading] = useState(false)
  
  // Form States
  const [targetPortfolioId, setTargetPortfolioId] = useState<number>(0)
  const [ticker, setTicker] = useState('')
  const [assetName, setAssetName] = useState('')
  const [type, setType] = useState('Stock')
  const [action, setAction] = useState('Buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  // Search States
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)

  const supabase = createClient()

  // Initialize Target Portfolio
  useEffect(() => {
    if (isOpen) {
        if (selectedPortfolio.id !== 'all') {
            setTargetPortfolioId(selectedPortfolio.id as number)
        } else if (portfolios.length > 0) {
            setTargetPortfolioId(portfolios[0].id as number)
        }
    }
  }, [isOpen, selectedPortfolio, portfolios])

  // Search Logic
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
    if (item.type === 'MUTUALFUND') setType('Mutual Fund')
    else if (item.type === 'ETF') setType('Gold')
    else if (item.type === 'CURRENCY') setType('Currency')
    else setType('Stock')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      let finalPortfolioId = targetPortfolioId
      if (!finalPortfolioId || finalPortfolioId === 0) {
          const { data: userPortfolios } = await supabase.from('portfolios').select('id').eq('user_id', user.id)
          if (userPortfolios && userPortfolios.length > 0) {
              finalPortfolioId = userPortfolios[0].id
          } else {
              const { data: newPortfolio, error: createError } = await supabase.from('portfolios').insert({ user_id: user.id, name: 'Main Portfolio' }).select().single()
              if (createError) throw createError
              finalPortfolioId = newPortfolio.id
              refreshPortfolios()
          }
      }

      // 1. Upsert Asset to get its ID
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .upsert({ ticker: ticker.toUpperCase(), name: assetName, asset_type: type }, { onConflict: 'ticker' })
        .select().single()

      if (assetError) throw assetError

      // 2. Logic based on Action
      let finalQty = Number(quantity)
      let finalPrice = Number(price)
      let calculatedPnL = 0

      if (action === 'Dividend' || action === 'Interest') {
          finalQty = 1
          finalPrice = Number(price)
      } 
      else if (action === 'Sell') {
        // --- VALIDATION: Check if user owns enough shares ---
        const { data: history } = await supabase
            .from('transactions')
            .select('*')
            .eq('asset_id', assetData.id)
            .eq('portfolio_id', finalPortfolioId)
            .order('date', { ascending: true })
        
        const lots: { price: number, quantity: number }[] = []
        
        // Reconstruct Current Holdings (FIFO)
        history?.forEach(h => {
            if (h.transaction_type === 'Buy') {
                lots.push({ price: Number(h.price), quantity: Number(h.quantity) })
            } else if (h.transaction_type === 'Sell') {
                let sellQty = Number(h.quantity)
                while (sellQty > 0 && lots.length > 0) {
                    if (lots[0].quantity > sellQty) { 
                        lots[0].quantity -= sellQty
                        sellQty = 0 
                    } else { 
                        sellQty -= lots[0].quantity
                        lots.shift() 
                    }
                }
            }
        })

        // Calculate total currently held
        const currentHoldingQty = lots.reduce((sum, lot) => sum + lot.quantity, 0)

        if (Number(quantity) > currentHoldingQty) {
            throw new Error(`Insufficient Holdings! You only own ${currentHoldingQty} units of ${ticker}. Cannot sell ${quantity}.`)
        }

        // Calculate Realized P&L (FIFO) for this specific sale
        let qtyToSell = Number(quantity)
        let costBasis = 0
        
        // Clone lots to simulate sale without mutating original array for calculation
        const tempLots = JSON.parse(JSON.stringify(lots))
        
        for (const lot of tempLots) {
            if (qtyToSell <= 0) break
            const take = Math.min(lot.quantity, qtyToSell)
            costBasis += (take * lot.price)
            qtyToSell -= take
        }
        
        // Profit = Total Sell Value - Cost of specific units sold
        calculatedPnL = (Number(price) * Number(quantity)) - costBasis
      }

      // 3. Insert Transaction
      const { error: txnError } = await supabase.from('transactions').insert({
        user_id: user.id,
        asset_id: assetData.id,
        portfolio_id: finalPortfolioId,
        transaction_type: action,
        date: date,
        quantity: finalQty,
        price: finalPrice,
        realised_pnl: calculatedPnL
      })

      if (txnError) throw txnError

      alert('Transaction saved!')
      onSuccess()
      onClose()
      setTicker(''); setAssetName(''); setQuantity(''); setPrice('')

    } catch (error: any) {
      alert('Error: ' + error.message) // Show the error alert
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white"
  const isIncome = action === 'Dividend' || action === 'Interest'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
        
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Transaction</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-6 w-6 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {portfolios.length > 1 && (
             <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Target Portfolio</label>
                <select value={targetPortfolioId} onChange={(e) => setTargetPortfolioId(Number(e.target.value))} className={inputClass}>
                    {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
          )}

         <div className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ticker / Symbol</label>
            <div className="relative">
                <input 
                    required type="text" placeholder="Search e.g. TCS, HDFC..." 
                    value={ticker}
                    onChange={(e) => { setTicker(e.target.value); setShowResults(true) }}
                    className={`${inputClass} pl-9 pr-8`} 
                    autoComplete="off"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                
                {/* Clear Button */}
                {ticker && !searching && (
                    <button 
                        type="button" 
                        onClick={() => { setTicker(''); setShowResults(false); }}
                        className="absolute right-3 top-2.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
                {searching && <div className="absolute right-3 top-2.5"><Loader2 className="h-4 w-4 animate-spin text-indigo-600" /></div>}
            </div>
            {showResults && results.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:bg-slate-900 dark:border-slate-700">
                    {results.map((item) => (
                        <li key={item.symbol} onClick={() => handleSelectAsset(item)} className="cursor-pointer px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800">
                            <div className="font-bold text-slate-900 dark:text-white">{item.symbol}</div>
                            <div className="flex justify-between text-xs text-slate-500"><span>{item.name}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{item.type}</span></div>
                        </li>
                    ))}
                </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Action</label>
              <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {['Buy', 'Sell', 'Dividend', 'Interest'].map(act => (
                    <button 
                        key={act}
                        type="button" 
                        onClick={() => setAction(act)} 
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${action === act ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}
                    >
                        {act}
                    </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!isIncome && (
                <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Quantity</label>
                <input required type="number" step="any" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
                </div>
            )}
            <div className={isIncome ? "col-span-2" : ""}>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isIncome ? 'Total Amount Received (₹)' : 'Price per Unit (₹)'}
              </label>
              <input required type="number" step="any" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}