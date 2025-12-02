'use client'

import { useState, useMemo } from 'react'
import { Bell, Trash2, CheckCircle2, RefreshCw, Loader2, Activity } from 'lucide-react'
import { useAlerts, useLivePrices } from '@/hooks/use-portfolio-data'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export default function AlertsPage() {
  const [checking, setChecking] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()

  // 1. Fetch Alerts (Cached)
  const { data: alerts, isLoading: alertsLoading } = useAlerts()

  // 2. Derive Tickers for Price Check
  const alertTickers = useMemo(() => {
      return alerts ? Array.from(new Set(alerts.map(a => a.ticker))) : []
  }, [alerts])

  // 3. Fetch Live Prices (Auto-Refresh)
  const { data: priceMap, isLoading: pricesLoading } = useLivePrices(alertTickers)

  const loading = alertsLoading || pricesLoading

  // Handlers
  const handleDelete = async (id: number) => {
      if(!confirm("Delete this alert?")) return
      await supabase.from('price_alerts').delete().eq('id', id)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }

  const handleCheckPrices = async () => {
      setChecking(true)
      try {
          // Trigger the backend check logic manually
          await fetch('/api/alerts/check', { method: 'POST' })
          // Refresh data
          await queryClient.invalidateQueries({ queryKey: ['alerts'] })
          await queryClient.invalidateQueries({ queryKey: ['prices'] })
      } catch (e) {
          console.error(e)
      } finally {
          setChecking(false)
      }
  }

  // Filter Active vs Triggered
  const activeAlerts = alerts?.filter(a => !a.triggered_at) || []
  const triggeredAlerts = alerts?.filter(a => a.triggered_at) || []

  // Component for Single Alert Row
  const AlertCard = ({ alert, isTriggered = false }: any) => {
      const currentPrice = priceMap?.[alert.ticker]?.price || 0
      const diff = currentPrice > 0 ? ((currentPrice - alert.target_price) / alert.target_price) * 100 : 0
      const isClose = Math.abs(diff) < 2 

      return (
        <div className={`flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all ${isTriggered ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center gap-4">
                <div className={`rounded-full p-2 ${isTriggered ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {isTriggered ? <CheckCircle2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{alert.ticker}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Target: <span className="font-medium text-slate-700 dark:text-slate-300">₹{alert.target_price.toLocaleString('en-IN')}</span>
                        <span className="mx-1">•</span>
                        {alert.condition === 'above' ? 'Goes Above' : 'Goes Below'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {!isTriggered && (
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {currentPrice > 0 ? `₹${currentPrice.toLocaleString('en-IN')}` : 'Loading...'}
                        </div>
                        <div className={`text-xs font-medium ${isClose ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`}>
                            {currentPrice > 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}% away` : 'Live Price'}
                        </div>
                    </div>
                )}
                
                {isTriggered && (
                    <div className="text-right hidden sm:block">
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">
                            Notification Sent
                        </span>
                    </div>
                )}

                <button 
                    onClick={() => handleDelete(alert.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition dark:hover:bg-red-900/20"
                    title="Delete Alert"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
      )
  }

  if (loading && !alerts) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Top Actions (Title removed) */}
      <div className="flex justify-end">
        <button 
            onClick={handleCheckPrices}
            disabled={checking}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-70"
        >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check Prices Now'}
        </button>
      </div>

      {/* 1. NEW NOTIFICATIONS SECTION */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4" /> New Notifications
        </h3>
        
        {triggeredAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
                No new notifications.
            </div>
        ) : (
            <div className="space-y-3">
                {triggeredAlerts.map(alert => <AlertCard key={alert.id} alert={alert} isTriggered={true} />)}
            </div>
        )}
      </div>

      {/* 2. ACTIVE WATCHLIST SECTION */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4" /> Active Watchlist
        </h3>
        
        {activeAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 dark:border-slate-700">
                No active price alerts set.
            </div>
        ) : (
            <div className="grid gap-3">
                {activeAlerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
            </div>
        )}
      </div>

    </div>
  )
}