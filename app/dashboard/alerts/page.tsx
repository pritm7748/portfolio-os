'use client'

import { useState, useMemo } from 'react'
import { Bell, Trash2, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Plus } from 'lucide-react'
import { useAlerts, useLivePrices } from '@/hooks/use-portfolio-data'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import AlertModal from '@/components/alert-modal'

export default function AlertsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
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

  const handleDelete = async (id: number) => {
      if(!confirm("Delete this alert?")) return
      await supabase.from('price_alerts').delete().eq('id', id)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }

  // Separate Active vs Triggered
  const activeAlerts = alerts?.filter(a => !a.triggered_at) || []
  const triggeredAlerts = alerts?.filter(a => a.triggered_at) || []

  const AlertCard = ({ alert, isTriggered = false }: any) => {
      const currentPrice = priceMap?.[alert.ticker]?.price || 0
      // Calculate distance to target if active
      const diff = currentPrice > 0 ? ((currentPrice - alert.target_price) / alert.target_price) * 100 : 0
      const isClose = Math.abs(diff) < 2 // Within 2% range

      return (
        <div className={`flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all ${isTriggered ? 'bg-slate-50 border-slate-200 opacity-70 dark:bg-slate-900 dark:border-slate-800' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
            <div className="flex items-center gap-4">
                <div className={`rounded-full p-2 ${isTriggered ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
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
                        <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full dark:bg-green-900/30 dark:text-green-400">
                            Triggered
                        </span>
                    </div>
                )}

                <button 
                    onClick={() => handleDelete(alert.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition dark:hover:bg-red-900/20"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
      )
  }

  if (loading && !alerts) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Alerts & Notifications</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your price targets.</p>
        </div>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
        >
            <Plus className="h-4 w-4" /> Set New Alert
        </button>
      </div>

      {/* Active Alerts */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" /> Active Watchlist
        </h3>
        {activeAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                No active alerts. Set one to get notified.
            </div>
        ) : (
            activeAlerts.map(alert => <AlertCard key={alert.id} alert={alert} />)
        )}
      </div>

      {/* Triggered History */}
      {triggeredAlerts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Bell className="h-4 w-4" /> Past Notifications
            </h3>
            {triggeredAlerts.map(alert => <AlertCard key={alert.id} alert={alert} isTriggered={true} />)}
          </div>
      )}

      {/* Modal Reused */}
      {isModalOpen && (
          <AlertModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            // Optional: Pass null to force user to type ticker
            ticker="" 
            currentPrice={0}
          />
      )}
    </div>
  )
}

function ActivityIcon({className}: {className?: string}) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}