'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckSquare, Square } from 'lucide-react'

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true) // Default: Checked
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  // Helper to configure persistence
  const configurePersistence = async () => {
    try {
      // 1. Determine Mode using native Browser APIs
      // If 'Keep me signed in' is checked -> Use Local Storage (Persist across closes)
      // If unchecked -> Use Session Storage (Clear on close)
      const storage = keepSignedIn ? localStorage : sessionStorage
      
      // 2. Apply Setting
      // We cast to 'any' because TypeScript sometimes misses this method in the definitions
      await (supabase.auth as any).setPersistence(storage)
    } catch (e) {
      console.warn("Persistence setting failed, falling back to default", e)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      await configurePersistence() // <--- Apply preference

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

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      await configurePersistence() // <--- Apply preference

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) throw error
    } catch (error: any) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <h2 className="mb-6 text-center text-2xl font-bold text-white drop-shadow-md">
        {isLogin ? 'Welcome Back' : 'Create Account'}
      </h2>

      {/* GOOGLE LOGIN BUTTON */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/30 bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-70 shadow-md transition-all backdrop-blur-md mb-6"
      >
        {loading ? (
            <span className="text-slate-200 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
            </span>
        ) : (
            <>
                {/* Google SVG Icon */}
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continue with Google</span>
            </>
        )}
      </button>

      {/* DIVIDER */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-px flex-1 bg-white/20"></div>
        <span className="text-xs uppercase text-slate-300 font-medium">Or with email</span>
        <div className="h-px flex-1 bg-white/20"></div>
      </div>

      {/* EMAIL FORM */}
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-200 drop-shadow-sm">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-white/30 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all backdrop-blur-sm"
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
            className="w-full rounded-lg border border-white/30 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all backdrop-blur-sm"
            placeholder="••••••••"
          />
        </div>

        {/* CHECKBOX: KEEP ME SIGNED IN */}
        <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => setKeepSignedIn(!keepSignedIn)}
        >
            <div className={`transition-colors ${keepSignedIn ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                {keepSignedIn ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </div>
            <span className="text-xs text-slate-200 select-none group-hover:text-white transition-colors">
                Keep me signed in
            </span>
        </div>

        {message && (
          <p className={`text-center text-xs font-medium drop-shadow-sm ${message.includes('Check') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600/90 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 shadow-lg transition-colors border border-white/10 backdrop-blur-sm"
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