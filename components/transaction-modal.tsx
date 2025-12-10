'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Search, Info, Calculator, ArrowRight } from 'lucide-react'
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
  const [otherCharges, setOtherCharges] = useState('') // <--- NEW: Brokerage/Taxes
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  // Search States
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)

  // Averaging Data
  const [existingHolding, setExistingHolding] = useState<{ qty: number, avg: number } | null>(null)

  const supabase = createClient()

  // Initialize Target Portfolio
  useEffect(() => {
    if (isOpen) {
        if (selectedPortfolio.id !== 'all') {
            setTargetPortfolioId(selectedPortfolio.id as number)
        } else if (portfolios.length > 0) {
            setTargetPortfolioId(portfolios[0].id as number)
        }
        setExistingHolding(null)
        setOtherCharges('')
    }
  }, [isOpen, selectedPortfolio, portfolios])

  // --- SMART AVERAGING LOGIC (Exchange Agnostic) ---
  useEffect(() => {
      if (!ticker || !targetPortfolioId || !isOpen) return

      const fetchHolding = async () => {
          // 1. Identify Root Symbol (e.g. "TCS.BO" -> "TCS")
          const root = ticker.split('.')[0].toUpperCase()
          
          // 2. Search for ALL variants (TCS, TCS.NS, TCS.BO)
          // This ensures we find your existing holding even if you used a different exchange before
          const searchTickers = [root, `${root}.NS`, `${root}.BO`]

          const { data: assets } = await supabase
              .from('assets')
              .select('id')
              .in('ticker', searchTickers)
          
          if (!assets || assets.length === 0) {
              setExistingHolding(null)
              return
          }

          // 3. Get Transaction History for ALL matched IDs
          const assetIds = assets.map(a => a.id)
          const { data: txns } = await supabase
              .from('transactions')
              .select('transaction_type, quantity, price')
              .eq('portfolio_id', targetPortfolioId)
              .in('asset_id', assetIds) 
          
          if (!txns || txns.length === 0) {
              setExistingHolding(null)
              return
          }

          // 4. Calculate Weighted Average
          let totalQty = 0
          let totalCost = 0
          
          txns.forEach(t => {
              const q = Number(t.quantity)
              const p = Number(t.price)
              if (t.transaction_type === 'Buy') {
                  totalCost += (q * p)
                  totalQty += q
              } else if (t.transaction_type === 'Sell') {
                  if (totalQty > 0) {
                      const avg = totalCost / totalQty
                      totalCost -= (q * avg)
                      totalQty -= q
                  }
              }
          })

          if (totalQty > 0.0001) {
              setExistingHolding({ qty: totalQty, avg: totalCost / totalQty })
          } else {
              setExistingHolding(null)
          }
      }

      const timer = setTimeout(fetchHolding, 500)
      return () => clearTimeout(timer)
  }, [ticker, targetPortfolioId, isOpen])


  // --- CALCULATOR PREVIEW ---
  const projectedStats = useMemo(() => {
      if (action !== 'Buy') return null
      
      const newQty = Number(quantity) || 0
      const newPrice = Number(price) || 0
      const extra = Number(otherCharges) || 0
      
      if (newQty <= 0 || newPrice <= 0) return null

      const currentQty = existingHolding?.qty || 0
      const currentAvg = existingHolding?.avg || 0
      const currentTotal = currentQty * currentAvg

      // Logic: (Old Cost + New Cost + Extras) / (Old Qty + New Qty)
      const newInvested = (newQty * newPrice) + extra
      const finalQty = currentQty + newQty
      const finalAvg = (currentTotal + newInvested) / finalQty

      return {
          oldAvg: currentAvg,
          newAvg: finalAvg,
          change: finalAvg - currentAvg
      }
  }, [quantity, price, otherCharges, existingHolding, action])


  // Search Logic
  useEffect(() => {
    if (type === 'Commodity') return 

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
  }, [ticker, showResults, type])

  // Handle Commodity Defaults
  useEffect(() => {
      if (type === 'Commodity') {
          if (!ticker.startsWith('COMMODITY:')) {
              setTicker('COMMODITY:GOLD')
              setAssetName('Physical Gold (24K)')
          }
          if (action === 'Dividend' || action === 'Interest') setAction('Buy')
      } else {
          if (ticker.startsWith('COMMODITY:')) {
              setTicker('')
              setAssetName('')
          }
      }
  }, [type])

  const handleSelectAsset = (item: SearchResult) => {
    setTicker(item.symbol)
    setAssetName(item.name)
    setShowResults(false)
    if (item.type === 'MUTUALFUND') setType('Mutual Fund')
    else if (item.type === 'CURRENCY') setType('Currency')
    else if (item.type === 'COMMODITY' || item.type === 'FUTURE') setType('Commodity')
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

      // Fetch Sector
      let sector = 'Unknown'
      let industry = 'Unknown'
      if (ticker) {
          try {
              const res = await fetch('/api/quote', { method: 'POST', body: JSON.stringify({ ticker }) })
              const meta = await res.json()
              if (meta.sector) sector = meta.sector
              if (meta.industry) industry = meta.industry
          } catch(e) {}
      }

      // 1. Upsert Asset
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .upsert({ ticker, name: assetName, asset_type: type, sector, industry }, { onConflict: 'ticker' })
        .select().single()

      if (assetError) throw assetError

      // 2. Logic based on Action
      let finalQty = Number(quantity)
      let finalPrice = Number(price)
      let calculatedPnL = 0
      
      // Note: We currently DO NOT store 'otherCharges' in the DB because the schema might not have a 'fees' column yet.
      // But we use it here to adjust the Realized PnL calculation if it's a Sell.
      
      if (action === 'Sell') {
        const { data: history } = await supabase
            .from('transactions')
            .select('*')
            .eq('asset_id', assetData.id)
            .eq('portfolio_id', finalPortfolioId)
            .order('date', { ascending: true })
        
        const lots: any[] = []
        history?.forEach(h => {
            if (h.transaction_type === 'Buy') lots.push({ price: Number(h.price), quantity: Number(h.quantity) })
            else if (h.transaction_type === 'Sell') {
                let sellQty = Number(h.quantity)
                while (sellQty > 0 && lots.length > 0) {
                    if (lots[0].quantity > sellQty) { lots[0].quantity -= sellQty; sellQty = 0 } 
                    else { sellQty -= lots[0].quantity; lots.shift() }
                }
            }
        })

        const currentHoldingQty = lots.reduce((sum, lot) => sum + lot.quantity, 0)
        if (Number(quantity) > currentHoldingQty + 0.0001) throw new Error(`Insufficient Holdings!`)

        let qtyToSell = Number(quantity)
        let costBasis = 0
        const tempLots = JSON.parse(JSON.stringify(lots))
        for (const lot of tempLots) {
            if (qtyToSell <= 0) break
            const take = Math.min(lot.quantity, qtyToSell)
            costBasis += (take * lot.price)
            qtyToSell -= take
        }
        
        // PnL = (Sell Value - Fees) - Cost Basis
        const sellValue = (Number(price) * Number(quantity)) - Number(otherCharges)
        calculatedPnL = sellValue - costBasis
      }

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
      setTicker(''); setAssetName(''); setQuantity(''); setPrice(''); setOtherCharges('')

    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white"
  const isIncome = action === 'Dividend' || action === 'Interest'
  
  const availableActions = (type === 'Commodity' || type === 'Currency') 
    ? ['Buy', 'Sell'] 
    : ['Buy', 'Sell', 'Dividend', 'Interest']

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Transaction</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-6 w-6 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Portfolio Select */}
          {portfolios.length > 1 && (
             <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Target Portfolio</label>
                <select value={targetPortfolioId} onChange={(e) => setTargetPortfolioId(Number(e.target.value))} className={inputClass}>
                    {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
          )}

          {/* 1. Asset Type */}
          <div>
               <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Asset Type</label>
               <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                <option value="Stock">Stock</option>
                <option value="Mutual Fund">Mutual Fund</option>
                <option value="Commodity">Commodity (Physical)</option>
                <option value="Currency">Currency</option>
              </select>
          </div>

          {/* 2. Asset Selection */}
          {type === 'Commodity' ? (
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Metal</label>
                    <select 
                        className={inputClass}
                        onChange={(e) => {
                            const val = e.target.value
                            if (val === 'gold24') { setTicker('COMMODITY:GOLD'); setAssetName('Physical Gold (24K)') }
                            if (val === 'gold22') { setTicker('COMMODITY:GOLD22'); setAssetName('Physical Gold (22K)') }
                            if (val === 'silver') { setTicker('COMMODITY:SILVER'); setAssetName('Physical Silver') }
                        }}
                        defaultValue="gold24"
                    >
                        <option value="gold24">Gold (24K)</option>
                        <option value="gold22">Gold (22K)</option>
                        <option value="silver">Silver</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Label</label>
                    <input type="text" value={assetName} onChange={(e) => setAssetName(e.target.value)} className={inputClass} />
                  </div>
              </div>
          ) : (
              <div>
                  <div className="relative">
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ticker / Asset</label>
                    <div className="relative">
                        <input 
                            required type="text" placeholder="Search e.g. TCS, HDFC..." 
                            value={ticker}
                            onChange={(e) => { setTicker(e.target.value); setShowResults(true) }}
                            className={`${inputClass} pl-9 pr-8`} 
                            autoComplete="off"
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        
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
              </div>
          )}

          {/* Action Buttons */}
          <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Action</label>
              <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {availableActions.map(act => (
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

          {/* Qty & Price */}
          <div className="grid grid-cols-2 gap-4">
            {!isIncome && (
                <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {type === 'Commodity' ? 'Qty (10g / Kg)' : 'Quantity'}
                </label>
                <input required type="number" step="any" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
                </div>
            )}
            <div className={isIncome ? "col-span-2" : ""}>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isIncome ? 'Amount Received (₹)' : 'Price per Unit (₹)'}
              </label>
              <input required type="number" step="any" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* NEW: Other Charges & Date */}
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Other (Brokerage/Tax)</label>
                  <input type="number" step="any" placeholder="0.00" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className={inputClass} />
              </div>
              <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
          </div>

          {/* --- CALCULATOR PREVIEW --- */}
          {projectedStats && (
              <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                  <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">New Average Preview</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                      <div className="text-slate-500 dark:text-slate-400">
                          <span className="block text-[10px]">Current Avg</span>
                          <span className="font-semibold">₹{projectedStats.oldAvg.toFixed(2)}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <div className="text-indigo-700 dark:text-indigo-400">
                          <span className="block text-[10px] text-right">New Avg</span>
                          <span className="font-bold text-lg">₹{projectedStats.newAvg.toFixed(2)}</span>
                      </div>
                  </div>
                  <div className="mt-1 text-right">
                      <span className={`text-[10px] font-medium ${projectedStats.change < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          {projectedStats.change < 0 ? 'Average reducing by ' : 'Average increasing by '}
                          ₹{Math.abs(projectedStats.change).toFixed(2)}
                      </span>
                  </div>
              </div>
          )}

          <div className="mt-6 flex justify-end gap-3 pt-2">
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