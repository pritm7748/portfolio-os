'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2, Bell, BellRing, CheckCircle, RefreshCw } from 'lucide-react' // Added RefreshCw

type Alert = {
  id: number
  ticker: string
  target_price: number
  condition: 'above' | 'below'
  triggered_at: string | null 
  created_at: string
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false) // State for manual check
  const supabase = createClient()

  const fetchAlerts = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
        setAlerts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const handleDelete = async (id: number) => {
    await supabase.from('price_alerts').delete().eq('id', id)
    setAlerts(alerts.filter(a => a.id !== id))
    window.location.reload() 
  }

  // --- MANUAL TRIGGER FUNCTION ---
  const runManualCheck = async () => {
      setChecking(true)
      try {
          // We call the same API that the Cron Job uses
          // Note: You might need to temporarily remove the CRON_SECRET check in /api/cron 
          // OR create a new public route for manual testing. 
          // For now, let's simulate the check client-side for immediate feedback.
          
          const activeAlerts = alerts.filter(a => !a.triggered_at)
          if (activeAlerts.length === 0) {
              alert("No active alerts to check.")
              return
          }

          const tickers = activeAlerts.map(a => a.ticker)
          const res = await fetch('/api/prices', {
              method: 'POST',
              body: JSON.stringify({ tickers })
          })
          const prices = await res.json()

          let triggeredCount = 0
          
          for (const alert of activeAlerts) {
              const currentPrice = prices[alert.ticker]
              if (!currentPrice) continue

              let triggered = false
              if (alert.condition === 'above' && currentPrice >= alert.target_price) triggered = true
              if (alert.condition === 'below' && currentPrice <= alert.target_price) triggered = true

              if (triggered) {
                  await supabase
                    .from('price_alerts')
                    .update({ triggered_at: new Date().toISOString() })
                    .eq('id', alert.id)
                  triggeredCount++
              }
          }

          if (triggeredCount > 0) {
              alert(`Success! ${triggeredCount} alerts triggered.`)
              window.location.reload() // Refresh to see red dot
          } else {
              alert("Checked prices. No new alerts triggered.")
          }

      } catch (e) {
          console.error(e)
          alert("Failed to check prices")
      } finally {
          setChecking(false)
      }
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  const triggeredAlerts = alerts.filter(a => a.triggered_at !== null)
  const activeAlerts = alerts.filter(a => a.triggered_at === null)

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Alerts & Notifications</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your price targets.</p>
        </div>
        <button 
            onClick={runManualCheck} 
            disabled={checking}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check Prices Now
        </button>
      </div>

      {/* 1. NOTIFICATIONS (Triggered) */}
      <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <BellRing className="h-4 w-4" /> New Notifications
          </h3>
          
          {triggeredAlerts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400 dark:bg-slate-900 dark:border-slate-800">
                  No new notifications.
              </div>
          ) : (
              triggeredAlerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:bg-indigo-900/20 dark:border-indigo-900">
                      <div className="flex items-center gap-4">
                          <div className="rounded-full bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
                              <BellRing className="h-5 w-5" />
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-900 dark:text-white">Target Hit: {alert.ticker}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                  Price crossed {alert.condition.toUpperCase()} ₹{alert.target_price.toLocaleString('en-IN')}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                  Triggered on: {new Date(alert.triggered_at!).toLocaleDateString()}
                              </p>
                          </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(alert.id)}
                        className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Dismiss
                      </button>
                  </div>
              ))
          )}
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* 2. ACTIVE WATCHLIST */}
      <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Bell className="h-4 w-4" /> Active Watchlist
          </h3>

          {activeAlerts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400 dark:bg-slate-900 dark:border-slate-800">
                  No active alerts set. Go to Watchlist to add one.
              </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
                {activeAlerts.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">{alert.ticker}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Target: <span className="font-mono font-semibold">₹{alert.target_price.toLocaleString('en-IN')}</span>
                                <span className="ml-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">
                                    {alert.condition === 'above' ? 'GOES ABOVE' : 'DROPS BELOW'}
                                </span>
                            </div>
                        </div>
                        
                        <button onClick={() => handleDelete(alert.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition dark:hover:bg-red-900/20" title="Delete Alert">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
          )}
      </div>
    </div>
  )
}