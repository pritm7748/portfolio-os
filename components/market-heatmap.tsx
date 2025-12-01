'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { SECTOR_CONSTITUENTS } from '@/lib/market-data'

type HeatmapItem = {
  ticker: string
  name: string
  price: number
  change: number
}

export default function MarketHeatmap() {
  const [data, setData] = useState<HeatmapItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHeatmap = async () => {
    setLoading(true)
    try {
      // 1. Get Nifty 50 Tickers
      const tickers = SECTOR_CONSTITUENTS['^NSEI'] || []
      
      // 2. Fetch Prices
      const res = await fetch('/api/prices', {
          method: 'POST',
          body: JSON.stringify({ tickers, detailed: true })
      })
      const priceMap = await res.json()

      // 3. Transform Data
      const items = tickers.map(t => {
          const p = priceMap[t] || { price: 0, change: 0 }
          return {
              ticker: t,
              name: t.replace('.NS', ''),
              price: p.price,
              change: p.change
          }
      })

      // 4. Sort by Performance (Best -> Worst)
      items.sort((a, b) => b.change - a.change)
      
      setData(items)
    } catch (e) {
        console.error(e)
    } finally {
        setLoading(false)
    }
  }

  useEffect(() => {
    fetchHeatmap()
  }, [])

  // Color Logic based on % Change strength
  const getColor = (change: number) => {
      if (change >= 3) return 'bg-green-600'
      if (change >= 1.5) return 'bg-green-500'
      if (change > 0) return 'bg-green-400'
      if (change === 0) return 'bg-slate-400'
      if (change > -1.5) return 'bg-red-400'
      if (change > -3) return 'bg-red-500'
      return 'bg-red-600'
  }

  if (loading) return (
      <div className="h-64 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
  )

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Nifty 50 Heatmap</h3>
            <button onClick={fetchHeatmap} className="p-2 text-slate-400 hover:text-indigo-600 transition">
                <RefreshCw className="h-4 w-4" />
            </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
            {data.map(item => (
                <div 
                    key={item.ticker}
                    className={`${getColor(item.change)} p-3 rounded-md text-white flex flex-col justify-between h-24 transition hover:scale-105 hover:z-10 cursor-default shadow-sm`}
                    title={`${item.name}: ₹${item.price.toLocaleString()} (${item.change.toFixed(2)}%)`}
                >
                    <div className="text-xs font-bold truncate">{item.name}</div>
                    <div className="text-right">
                        <div className="text-[10px] opacity-90">
                            {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                        </div>
                        <div className="text-xs font-medium">
                            ₹{item.price < 1000 ? item.price.toFixed(1) : item.price.toFixed(0)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  )
}