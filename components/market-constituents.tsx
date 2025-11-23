// components/market-constituents.tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, TrendingUp, TrendingDown } from 'lucide-react'

type Props = {
  indexName: string
  tickers: string[]
  onClose: () => void
  filterText?: string // <--- New Prop
}

type StockData = {
    ticker: string
    name: string
    price: number
    change: number
}

export default function MarketConstituents({ indexName, tickers, onClose, filterText = '' }: Props) {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchConstituents = async () => {
      if (!tickers || tickers.length === 0) {
        setStocks([])
        return
      }

      setLoading(true)
      try {
        const res = await fetch('/api/prices', {
          method: 'POST',
          body: JSON.stringify({ tickers, detailed: true }), 
        })
        const dataMap = await res.json()

        const stockData = tickers.map(t => {
            const data = dataMap[t] || { price: 0, change: 0 }
            return {
                ticker: t,
                name: t.replace('.NS', '').replace('.BO', ''),
                price: data.price,
                change: data.change
            }
        })
        
        setStocks(stockData.sort((a, b) => b.change - a.change))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    fetchConstituents()
  }, [tickers])

  // Filter stocks based on the search query
  const filteredStocks = stocks.filter(stock => 
    stock.name.toLowerCase().includes(filterText.toLowerCase()) || 
    stock.ticker.toLowerCase().includes(filterText.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
        <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{indexName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                {filteredStocks.length} Constituents
            </p>
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-600 hover:shadow-sm dark:hover:bg-slate-800 dark:hover:text-slate-200 transition">
            <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
             No stocks match your search.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredStocks.map((stock) => {
                const isPositive = stock.change >= 0
                return (
                  <div key={stock.ticker} className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <div className="min-w-0 flex-1 pr-4">
                        <div className="truncate font-medium text-slate-900 dark:text-slate-200">{stock.name}</div>
                        <div className="text-xs text-slate-400">{stock.ticker}</div>
                    </div>
                    <div className="text-right">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                            ₹{stock.price.toLocaleString('en-IN')}
                        </div>
                        <div className={`flex items-center justify-end text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                            {Math.abs(stock.change).toFixed(2)}%
                        </div>
                    </div>
                  </div>
                )
            })}
          </div>
        )}
      </div>
    </div>
  )
}