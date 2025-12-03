'use client'

import { useState, useMemo } from 'react'
import { useTransactions, usePulse } from '@/hooks/use-portfolio-data'
import { Loader2, Calendar, User, TrendingUp, TrendingDown, Megaphone, Briefcase } from 'lucide-react'

export default function PulsePage() {
  // 1. Get Holdings
  const { data: transactions } = useTransactions()
  
  // 2. Identify Top 10 Holdings (by Value/Qty) to track
  // We limit to 10 to keep the API fast
  const topTickers = useMemo(() => {
      if (!transactions) return []
      const map: Record<string, number> = {}
      transactions.forEach(t => {
          map[t.assets.ticker] = (map[t.assets.ticker] || 0) + (Number(t.quantity) * Number(t.price))
      })
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(x => x[0])
  }, [transactions])

  // 3. Fetch Intelligence
  const { data, isLoading } = usePulse(topTickers)

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-8">
      <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Market Pulse</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Intelligence for your top 10 holdings.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
          
          {/* COLUMN 1: EVENT CALENDAR */}
          <div className="space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-500" /> Earnings & Dividends
              </h3>
              
              {!data?.events || data.events.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 bg-white dark:bg-slate-900 dark:border-slate-800">
                      No upcoming events found.
                  </div>
              ) : (
                  <div className="space-y-3">
                      {data.events.map((event: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                              <div className="flex flex-col items-center justify-center rounded-lg bg-indigo-50 p-3 min-w-[60px] dark:bg-indigo-900/20">
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                      {new Date(event.date).toLocaleString('default', { month: 'short' }).toUpperCase()}
                                  </span>
                                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                                      {new Date(event.date).getDate()}
                                  </span>
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-900 dark:text-white">{event.ticker}</h4>
                                  <p className="text-sm text-slate-500 dark:text-slate-400">{event.desc}</p>
                              </div>
                              <div className="ml-auto">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${event.type === 'Earnings' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                      {event.type}
                                  </span>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* COLUMN 2: WHALE WATCH */}
          <div className="space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-amber-500" /> The Whale Watch (Insider Activity)
              </h3>

              {!data?.insiders || data.insiders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 bg-white dark:bg-slate-900 dark:border-slate-800">
                      No major insider activity detected recently.
                  </div>
              ) : (
                  <div className="space-y-3">
                      {data.insiders.map((txn: any, i: number) => {
                          const isBuy = txn.action.toLowerCase().includes('buy') || txn.action.toLowerCase().includes('purchase')
                          return (
                              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <h4 className="font-bold text-slate-900 dark:text-white">{txn.ticker}</h4>
                                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                              <User className="h-3 w-3" /> {txn.holder} ({txn.relation})
                                          </p>
                                      </div>
                                      <span className="text-xs text-slate-400">
                                          {new Date(txn.date).toLocaleDateString()}
                                      </span>
                                  </div>
                                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
                                      <span className={`flex items-center gap-1 text-sm font-bold ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                                          {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                          {isBuy ? 'Bought' : 'Sold'} {Number(txn.shares).toLocaleString()} shares
                                      </span>
                                      <span className="text-xs font-mono text-slate-500">
                                           Value: ₹{(txn.value / 10000000).toFixed(2)} Cr
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