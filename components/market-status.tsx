// components/market-status.tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, ArrowRight } from 'lucide-react' // Added ArrowRight
import Link from 'next/link' // Added Link

type MarketIndex = {
  name: string
  ticker: string
  price: number
}

export default function MarketStatus() {
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const tickers = ['^NSEI', '^BSESN']
        const res = await fetch('/api/prices', {
          method: 'POST',
          body: JSON.stringify({ tickers }),
        })
        const priceMap = await res.json()

        const data = [
          { name: 'NIFTY 50', ticker: '^NSEI', price: priceMap['^NSEI'] || 0 },
          { name: 'SENSEX', ticker: '^BSESN', price: priceMap['^BSESN'] || 0 }
        ]
        setIndices(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchIndices()
  }, [])

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Major Indices</span>
        
        {/* THE LINK TO THE NEW PAGE */}
        <Link href="/dashboard/market" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
            View All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-4 flex-1">
        {indices.map((index) => (
            <div key={index.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-3">
                <div className="rounded-full bg-white p-2 shadow-sm dark:bg-slate-700">
                <TrendingUp className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                </div>
                <div>
                <h4 className="font-bold text-slate-900 dark:text-white">{index.name}</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">India</span>
                </div>
            </div>
            
            <div className="text-right">
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {index.price > 0 ? `₹${index.price.toLocaleString('en-IN')}` : 'Unavailable'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Live Index</div>
            </div>
            </div>
        ))}
      </div>
      
      <div className="mt-auto pt-4">
        <div className="rounded-lg bg-indigo-50 p-4 text-xs text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
            <strong>Tip:</strong> Use these benchmarks to compare your own portfolio's performance (XIRR).
        </div>
      </div>
    </div>
  )
}