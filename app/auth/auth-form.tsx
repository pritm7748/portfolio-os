'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/dashboard'
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <h2 className="mb-6 text-center text-2xl font-bold text-white drop-shadow-md">
        {isLogin ? 'Welcome Back' : 'Create Account'}
      </h2>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-200 drop-shadow-sm">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 backdrop-blur-md transition-all"
            placeholder="name@example.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-200 drop-shadow-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 backdrop-blur-md transition-all"
            placeholder="••••••••"
          />
        </div>

        {message && (
          <p className={`text-center text-xs font-medium drop-shadow-sm ${message.includes('Check') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600/80 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 shadow-lg backdrop-blur-sm transition-all border border-white/10"
        >
          {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-300">
        <span>
          {isLogin ? "Don't have an account?" : "Already have an account?"}
        </span>
        <button
          onClick={() => { setIsLogin(!isLogin); setMessage(''); }}
          className="ml-1 font-bold text-white hover:underline drop-shadow-sm"
        >
          {isLogin ? 'Sign up' : 'Log in'}
        </button>
      </div>
    </div>
  )
}