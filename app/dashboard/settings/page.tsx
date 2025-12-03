'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, Download, Trash2, AlertTriangle, Loader2, Save, CheckCircle } from 'lucide-react'
import { useProfile } from '@/hooks/use-portfolio-data'
import { useQueryClient } from '@tanstack/react-query'

export default function SettingsPage() {
  const { data, isLoading } = useProfile()
  const [fullName, setFullName] = useState('')
  const [updating, setUpdating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
      if (data?.profile?.full_name) {
          setFullName(data.profile.full_name)
      }
  }, [data])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data?.user) return
    setUpdating(true)
    setSuccessMsg('')

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: fullName, updated_at: new Date().toISOString() })
            .eq('id', data.user.id)

        if (error) throw error
        await queryClient.invalidateQueries({ queryKey: ['profile'] })
        setSuccessMsg('Profile updated successfully.')
        setTimeout(() => setSuccessMsg(''), 3000)
    } catch (error) {
        alert('Error updating profile')
    } finally {
        setUpdating(false)
    }
  }

  const handleExportData = async () => {
      if (!data?.user) return
      setExporting(true)
      try {
          const { data: transactions } = await supabase.from('transactions').select('*, assets(ticker, name, asset_type)').eq('user_id', data.user.id)
          const { data: portfolios } = await supabase.from('portfolios').select('*').eq('user_id', data.user.id)
          const { data: watchlist } = await supabase.from('watchlist').select('*').eq('user_id', data.user.id)

          const exportData = {
              timestamp: new Date().toISOString(),
              user_id: data.user.id,
              portfolios,
              transactions,
              watchlist
          }

          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)

      } catch (e) {
          console.error(e)
          alert("Failed to export data.")
      } finally {
          setExporting(false)
      }
  }

  const handlePasswordReset = async () => {
      if (!data?.user?.email) return
      const { error } = await supabase.auth.resetPasswordForEmail(data.user.email, {
          redirectTo: `${window.location.origin}/auth/update-password`,
      })
      if (error) alert("Error: " + error.message) 
      else alert("Password reset link sent to your email.")
  }

  const handleResetAccount = async () => {
      const confirmText = prompt("Type 'DELETE' to confirm deleting ALL your transactions and portfolios. This cannot be undone.")
      if (confirmText !== 'DELETE' || !data?.user) return

      try {
          await supabase.from('transactions').delete().eq('user_id', data.user.id)
          await supabase.from('portfolios').delete().eq('user_id', data.user.id)
          await supabase.from('watchlist').delete().eq('user_id', data.user.id)
          
          alert("Account reset complete. Please refresh.")
          window.location.reload()
      } catch (e) {
          console.error(e)
          alert("Failed to reset data.")
      }
  }

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* PROFILE */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <User className="h-5 w-5 text-indigo-500" /> Profile Information
          </h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input disabled value={data?.user?.email || ''} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Display Name</label>
                  <input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white" />
              </div>
              <div className="flex items-center gap-4">
                  <button type="submit" disabled={updating} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                      {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                  </button>
                  {successMsg && <span className="text-xs font-medium text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {successMsg}</span>}
              </div>
          </form>
      </div>

      {/* SECURITY */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-indigo-500" /> Security
          </h3>
          <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">Change your password via email link.</div>
              <button onClick={handlePasswordReset} className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800">Reset Password</button>
          </div>
      </div>

      {/* DATA EXPORT */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Download className="h-5 w-5 text-indigo-500" /> Data Sovereignty
          </h3>
          <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400 max-w-md">Download a complete backup of your data.</div>
              <button onClick={handleExportData} disabled={exporting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export All Data
              </button>
          </div>
      </div>

      {/* DANGER ZONE */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:bg-red-900/10 dark:border-red-900/30">
          <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-4"><AlertTriangle className="h-5 w-5" /> Danger Zone</h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-red-600/80 dark:text-red-400/80 max-w-md">Permanently delete all your transaction data and portfolios.</div>
              <button onClick={handleResetAccount} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 whitespace-nowrap">
                  <Trash2 className="h-4 w-4" /> Delete All Data
              </button>
          </div>
      </div>
    </div>
  )
}