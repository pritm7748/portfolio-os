'use client'

import AuthForm from './auth-form'
import { TrendingUp } from 'lucide-react'
import Image from 'next/image'

export default function AuthPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      
      {/* Full Screen Background Image */}
      <div className="absolute inset-0 z-0">
          <Image 
              src="/images/stock-trading-6525081.jpg" 
              alt="Background"
              fill
              className="object-cover"
              priority
          />
          {/* Dark overlay to make text pop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      {/* Centered Transparent Glass Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        
        {/* Logo & Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/90 text-white shadow-lg shadow-indigo-500/30 backdrop-blur-md">
            <TrendingUp className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">PortfolioOS</h1>
          <p className="mt-2 text-sm text-slate-200 drop-shadow-md">
            Professional Portfolio Tracker & Analysis
          </p>
        </div>

        {/* The Form Component */}
        <AuthForm />

        {/* Footer */}
        <div className="mt-8 text-center text-[10px] text-slate-400">
          &copy; {new Date().getFullYear()} PortfolioOS. Secure & Encrypted.
        </div>

      </div>
    </div>
  )
}