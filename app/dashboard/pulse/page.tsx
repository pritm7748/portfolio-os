'use client'

import { useMemo } from 'react'
import { useTransactions, usePulse } from '@/hooks/use-portfolio-data'
import { Loader2, Calendar, TrendingUp, TrendingDown, Briefcase, Zap, Globe, Activity } from 'lucide-react'

export default function PulsePage() {
  const { data: transactions } = useTransactions()
  
  // 1. GET ALL UNIQUE TICKERS (Removed Top 15 Limit)
  // We need to scan everything to catch volume shockers in small holdings
  const allTickers = useMemo(() => {
      if (!transactions) return []
      return Array.from(new Set(transactions.map(t => t.assets.ticker)))
  }, [transactions])

  const { data, isLoading } = usePulse(allTickers)

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-8 pb-20">
      
      {/* 1. MACRO DASHBOARD */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {data?.macro?.map((m: any, i: number) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                      {m.type === 'Currency' ? <Globe className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                      {m.name}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">{m.price.toFixed(2)}</span>
                      <span className={`text-xs font-medium ${m.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {m.change > 0 ? '+' : ''}{m.change.toFixed(2)}%
                      </span>
                  </div>
              </div>
          ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
          
          {/* COL 1: BIG MONEY RADAR (Volume Shockers) */}
          <div className="space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" /> Big Money Radar
              </h3>
              <p className="text-xs text-slate-500">Stocks with huge volume spikes (&gt;2.5x avg). Potential bulk deals.</p>
              
              {!data?.shockers || data.shockers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 dark:border-slate-800">
                      No unusual volume detected today.
                  </div>
              ) : (
                  <div className="space-y-3">
                      {data.shockers.map((s: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/50 p-4 dark:bg-amber-900/10 dark:border-amber-900/30">
                              <div>
                                  <h4 className="font-bold text-slate-900 dark:text-white">{s.ticker}</h4>
                                  <span className={`text-xs font-medium ${s.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {s.change > 0 ? '+' : ''}{s.change.toFixed(2)}% Today
                                  </span>
                              </div>
                              <div className="text-right">
                                  <span className="block text-lg font-bold text-amber-600 dark:text-amber-500">{s.ratio}</span>
                                  <span className="text-[10px] text-slate-500 uppercase">Vol vs Avg</span>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* COL 2: EVENT CALENDAR */}
          <div className="space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-500" /> Upcoming Events
              </h3>
              
              {!data?.events || data.events.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 dark:border-slate-800">
                      No earnings or dividends soon.
                  </div>
              ) : (
                  <div className="space-y-3">
                      {data.events.map((event: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                              <div className="flex flex-col items-center justify-center rounded-lg bg-indigo-50 p-2 min-w-[50px] dark:bg-indigo-900/20">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                      {new Date(event.date).toLocaleString('default', { month: 'short' }).toUpperCase()}
                                  </span>
                                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                                      {new Date(event.date).getDate()}
                                  </span>
                              </div>
                              <div>
                                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{event.ticker}</h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{event.desc}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* COL 3: WHALE WATCH (Insider) */}
          <div className="space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-500" /> Insider Activity
              </h3>

              {!data?.insiders || data.insiders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 dark:border-slate-800">
                      No recent insider trades found.
                  </div>
              ) : (
                  <div className="space-y-3">
                      {data.insiders.map((txn: any, i: number) => {
                          const isBuy = txn.action.toLowerCase().includes('buy') || txn.action.toLowerCase().includes('purchase')
                          return (
                              <div key={i} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                                  <div className="flex justify-between items-start mb-1">
                                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{txn.ticker}</h4>
                                      <span className="text-[10px] text-slate-400">{new Date(txn.date).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 truncate">
                                      {txn.holder} ({txn.relation})
                                  </p>
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                                      <span className={`flex items-center gap-1 text-xs font-bold ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                                          {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                          {isBuy ? 'Buy' : 'Sell'}
                                      </span>
                                      <span className="text-xs font-mono text-slate-500">
                                           ₹{(txn.value / 10000000).toFixed(2)}Cr
                                      </span>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              )}
          </div>

      </div>
    </div>
  )
}