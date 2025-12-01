'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Check if session exists (The link should log them in automatically)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // If no session, the link might be invalid or expired
        setMsg({ type: 'error', text: 'Invalid or expired reset link. Please request a new one.' })
      }
    }
    checkSession()
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      
      if (error) throw error

      setMsg({ type: 'success', text: 'Password updated successfully! Redirecting...' })
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

    } catch (error: any) {
      setMsg({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      
      {/* Background (Same as Auth Page) */}
      <div className="absolute inset-0 z-0">
          <Image 
              src="/images/stock-trading-6525081.jpg" 
              alt="Background"
              fill
              className="object-cover"
              priority
          />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      {/* Glass Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/90 text-white shadow-lg shadow-indigo-500/30">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
          <p className="mt-2 text-sm text-slate-300">
            Enter your new secure password below.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-200">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-white/30 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none transition-all"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {msg && (
            <div className={`flex items-center gap-2 rounded-lg p-3 text-xs font-medium ${
                msg.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
                {msg.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg transition-all border border-white/10"
          >
            {loading ? (
                <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Updating...</span>
            ) : (
                'Update Password'
            )}
          </button>
        </form>

      </div>
    </div>
  )
}