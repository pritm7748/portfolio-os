'use client'

import { useState, useEffect } from 'react'
import { X, Bell, Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

type AlertModalProps = {
  isOpen: boolean
  onClose: () => void
  ticker: string
  currentPrice?: number // Made OPTIONAL to support both Watchlist (passed) and Holdings (fetched)
  onSuccess?: () => void
}

export default function AlertModal({ isOpen, onClose, ticker, currentPrice: initialPrice, onSuccess }: AlertModalProps) {
  const [targetPrice, setTargetPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentPrice, setCurrentPrice] = useState<number | null>(initialPrice || null)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Reset and Fetch Price logic
  useEffect(() => {
    if (isOpen && ticker) {
      setTargetPrice('')
      
      // If parent provided price, use it. Otherwise fetch.
      if (initialPrice) {
          setCurrentPrice(initialPrice)
      } else {
          fetchPrice()
      }
    }
  }, [isOpen, ticker, initialPrice])

  const fetchPrice = async () => {
      setFetchingPrice(true)
      try {
          const res = await fetch('/api/prices', {
              method: 'POST',
              body: JSON.stringify({ tickers: [ticker] })
          })
          const data = await res.json()
          if (data[ticker]) {
              setCurrentPrice(data[ticker].price)
          }
      } catch (e) {
          console.error("Price fetch failed", e)
      } finally {
          setFetchingPrice(false)
      }
  }

  // Auto-determine condition based on target vs current
  const target = Number(targetPrice)
  const priceToCompare = currentPrice || 0
  const condition = (priceToCompare && target < priceToCompare) ? 'below' : 'above'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { error } = await supabase.from('price_alerts').insert({
        user_id: user.id,
        ticker: ticker,
        target_price: target,
        condition: condition,
        is_active: true
      })

      if (error) throw error

      // Invalidate queries to refresh UI immediately
      await queryClient.invalidateQueries({ queryKey: ['alerts'] })

      alert(`Alert set! You will be notified when ${ticker} goes ${condition} ₹${target}`)
      
      if (onSuccess) onSuccess()
      onClose()
      
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <Bell className="h-5 w-5" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Set Price Alert</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{ticker}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Current Price Info */}
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">Current Price</span>
            <div className="flex items-center gap-2">
                {fetchingPrice ? (
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                ) : (
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {currentPrice ? `₹${currentPrice.toLocaleString('en-IN')}` : '---'}
                    </span>
                )}
            </div>
          </div>

          {/* Target Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Target Price</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input 
                    type="number" 
                    required
                    step="any"
                    autoFocus
                    placeholder="0.00" 
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-8 pr-4 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white transition-all"
                />
            </div>
          </div>

          {/* Dynamic Condition Preview */}
          {target > 0 && currentPrice && (
              <div className={`flex items-center gap-2 text-sm p-2 rounded-lg ${condition === 'above' ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {condition === 'above' ? <TrendingUp className="h-4 w-4"/> : <TrendingDown className="h-4 w-4"/>}
                  <span>Alert when price goes <strong>{condition.toUpperCase()}</strong> ₹{target.toLocaleString()}</span>
              </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button 
                type="submit" 
                disabled={loading || !targetPrice} 
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Alert
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}