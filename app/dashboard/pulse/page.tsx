'use client'

import { useState, useMemo } from 'react'
import { useTransactions, usePulse } from '@/hooks/use-portfolio-data'
import {
  Loader2,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  Megaphone,
  Briefcase,
} from 'lucide-react'

export default function PulsePage() {
  // 1. Get Holdings
  const { data: transactions } = useTransactions()

  // 2. Identify Top 10 Holdings (by Value/Qty) to track
  // We limit to 10 to keep the API fast
  const topTickers = useMemo(() => {
    if (!transactions) return []
    const map: Record<string, number> = {}
    transactions.forEach((t) => {
      map[t.assets.ticker] =
        (map[t.assets.ticker] || 0) + Number(t.quantity) * Number(t.price)
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((x) => x[0])
  }, [transactions])

  // 3. Fetch Intelligence
  const { data, isLoading } = usePulse(topTickers)

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* COLUMN 1: EVENT CALENDAR */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <Calendar className="h-5 w-5 text-indigo-500" /> Earnings & Dividends
        </h3>

        {!data?.events || data.events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            No upcoming events found.
          </div>
        ) : (
          <div className="space-y-3">
            {data.events.map((event: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex min-w-[60px] flex-col items-center justify-center rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {new Date(event.date)
                      .toLocaleString('default', { month: 'short' })
                      .toUpperCase()}
                  </span>
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {new Date(event.date).getDate()}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {event.ticker}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {event.desc}
                  </p>
                </div>
                <div className="ml-auto">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      event.type === 'Earnings'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
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
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <Briefcase className="h-5 w-5 text-amber-500" /> The Whale Watch
          (Insider Activity)
        </h3>

        {!data?.insiders || data.insiders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            No major insider activity detected recently.
          </div>
        ) : (
          <div className="space-y-3">
            {data.insiders.map((txn: any, i: number) => {
              const isBuy =
                txn.action.toLowerCase().includes('buy') ||
                txn.action.toLowerCase().includes('purchase')

              return (
                <div
                  key={i}
                  className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">
                        {txn.ticker}
                      </h4>
                      <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <User className="h-3 w-3" /> {txn.holder} ({txn.relation})
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(txn.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3 dark:border-slate-800">
                    <span
                      className={`flex items-center gap-1 text-sm font-bold ${
                        isBuy ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isBuy ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {isBuy ? 'Bought' : 'Sold'}{' '}
                      {Number(txn.shares).toLocaleString()} shares
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
  )
}
