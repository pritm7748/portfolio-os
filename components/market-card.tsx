// components/market-card.tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

type MarketCardProps = {
  name: string
  ticker: string
  onClick?: () => void   // <--- New Prop
  isSelected?: boolean   // <--- New Prop
}

export default function MarketCard({ name, ticker, onClick, isSelected }: MarketCardProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/history', {
          method: 'POST',
          body: JSON.stringify({ ticker, range: '1d', interval: '5m' }), 
        })
        const result = await res.json()
        if (result && !result.error) {
            setData(result)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [ticker])

  const isPositive = data?.change >= 0
  const color = isPositive ? '#10b981' : '#ef4444'

  return (
    <div 
        onClick={onClick}
        className={`
            relative flex h-40 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-5 shadow-sm transition-all 
            ${isSelected 
                ? 'border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 bg-indigo-50/10' 
                : 'border-slate-100 bg-white hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900'
            }
        `}
    >
      {loading ? (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !data || !data.currentPrice ? (
        <div className="flex h-full w-full flex-col items-center justify-center text-sm text-slate-400">
            <Activity className="mb-2 h-6 w-6 opacity-20" />
            <span>Unavailable</span>
        </div>
      ) : (
        <>
            {/* Header Info */}
            <div className="mb-2 relative z-10">
                <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{name}</h3>
                </div>
                
                <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {data.currentPrice?.toLocaleString('en-IN')}
                    </span>
                    <span className={`flex items-center text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                        {Math.abs(data.changePercent).toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Sparkline Chart */}
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-50">
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.history}>
                    <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                </LineChart>
                </ResponsiveContainer>
            </div>
        </>
      )}
    </div>
  )
}