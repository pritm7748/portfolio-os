'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, TrendingUp, TrendingDown, Search, ArrowLeft } from 'lucide-react'

// FIX: Added filterText to the type definition
type Props = {
  indexName: string
  tickers: string[]
  onClose: () => void
  filterText?: string 
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
  const [localSearch, setLocalSearch] = useState('') 

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

  // Combine the search from the parent (filterText) with local input
  const query = localSearch || filterText

  const filteredStocks = stocks.filter(stock => 
    stock.name.toLowerCase().includes(query.toLowerCase()) || 
    stock.ticker.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                {/* Mobile Back Button (Visible only on small screens) */}
                <button 
                    onClick={onClose} 
                    className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                
                <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-none">{indexName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {filteredStocks.length} Constituents
                    </p>
                </div>
            </div>
            
            {/* Desktop Close Button (Visible only on large screens) */}
            <button 
                onClick={onClose} 
                className="hidden lg:block rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
                <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder={`Search in ${indexName}...`}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>
      </div>

      {/* Scrollable List */}
      {/* h-full ensures it takes remaining space, overflow-y-auto gives it internal scroll */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
             No stocks found.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredStocks.map((stock) => {
                const isPositive = stock.change >= 0
                return (
                  <div key={stock.ticker} className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-default">
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