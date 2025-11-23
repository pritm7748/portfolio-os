// app/auth/auth-form.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      if (isLogin) {
        // Logic for LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        setMessage('Logged in successfully! Redirecting...')
        window.location.href = '/dashboard' // We'll improve this redirect later
      } else {
        // Logic for SIGN UP
        // Logic for SIGN UP
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    // This line tells Supabase where to send the email confirmation link
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
})
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      }
    } catch (error: any) {
      if (error.message.includes('Password should be at least 6 characters')) {
        setMessage('Error: Password must be at least 6 characters long.')
      } else {
        setMessage(`Error: ${error.message}`)
      }
    }
  }

  return (
    <div className="flex h-full flex-col justify-center">
      {/* Tabs for Login / Sign Up - Themed to Indigo */}
      <div className="mb-8 flex border-b">
        <button
          onClick={() => setIsLogin(true)}
          className={`w-1/2 py-4 text-center text-lg font-medium ${
            isLogin
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Login
        </button>
        <button
          onClick={() => setIsLogin(false)}
          className={`w-1/2 py-4 text-center text-lg font-medium ${
            !isLogin
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign Up
        </button>
      </div>

      <h2 className="mb-8 text-left text-3xl font-bold text-gray-900">
        {isLogin ? 'Login to your account' : 'Create a new account'}
      </h2>

      {/* The Form - Themed to Indigo */}
      <form onSubmit={handleAuth} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 p-4 text-gray-900 transition focus:border-indigo-500 focus:ring-indigo-500 placeholder-gray-400"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 p-4 text-gray-900 transition focus:border-indigo-500 focus:ring-indigo-500 placeholder-gray-400"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 py-3 text-center text-lg font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300"
        >
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>

      {/* Display messages */}
      {message && (
        <p className="mt-4 text-center text-sm text-red-600">{message}</p>
      )}

      {/* Toggle between login/signup - Themed to Indigo */}
      <p className="mt-8 text-center text-sm text-gray-600">
        {isLogin ? "Don't have an account?" : 'Already have an account?'}
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="ml-2 font-medium text-indigo-600 hover:underline"
        >
          {isLogin ? 'Sign up' : 'Login'}
        </button>
      </p>
    </div>
  )
}