'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Bell, ChevronDown, User, Settings, LogOut, HelpCircle, CreditCard, Loader2, Menu } from 'lucide-react'
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  const [notificationCount, setNotificationCount] = useState(0)
  
  // Market Search State
  const [marketQuery, setMarketQuery] = useState('')
  const [marketResults, setMarketResults] = useState<any[]>([])
  const [isSearchingMarket, setIsSearchingMarket] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setUser({ ...user, ...profile })

        const { count, error } = await supabase
            .from('price_alerts')
            .select('*', { count: 'exact', head: true })
            .not('triggered_at', 'is', null)

        if (!error && count !== null) {
            setNotificationCount(count)
        }
      }
      setLoading(false)
    }
    getUser()
  }, [pathname])

  // Market Search Logic
  useEffect(() => {
    if (!pathname.includes('/market')) return

    const timer = setTimeout(async () => {
      if (marketQuery.length > 2) {
        setIsSearchingMarket(true)
        try {
            const res = await fetch(`/api/search?q=${marketQuery}`)
            const data = await res.json()
            setMarketResults(data)
        } catch (e) { console.error(e) } 
        finally { setIsSearchingMarket(false) }
      } else {
        setMarketResults([])
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [marketQuery, pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  const getTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard'
    if (pathname.includes('/holdings')) return 'Holdings'
    if (pathname.includes('/market')) return 'Market Status'
    if (pathname.includes('/analytics')) return 'Analytics'
    if (pathname.includes('/reports')) return 'Reports'
    if (pathname.includes('/settings')) return 'Account Settings'
    if (pathname.includes('/watchlist')) return 'Watchlist'
    if (pathname.includes('/alerts')) return 'Alerts & Notifications'
    if (pathname.includes('/dividends')) return 'Dividends'
    return 'Dashboard'
  }

  // Check if we should show search (Only on Market Page)
  const showSearch = pathname.includes('/dashboard/market')

  return (
    <header className="flex h-16 md:h-20 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 font-sans relative z-30">
      
      <div className="flex items-center gap-3">
        {/* MOBILE MENU BUTTON */}
        <button 
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-slate-800"
        >
            <Menu className="h-6 w-6" />
        </button>

        <h1 className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {getTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-6">
        
        {/* MARKET SEARCH BAR (Hidden on mobile, visible on desktop) */}
        {showSearch && (
            <div className="relative hidden lg:block">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search markets..."
                        value={marketQuery}
                        onChange={(e) => setMarketQuery(e.target.value)}
                        className="h-10 w-64 rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    {isSearchingMarket && <Loader2 className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-indigo-600" />}
                </div>

                {marketResults.length > 0 && (
                    <ul className="absolute left-0 top-full mt-2 max-h-80 w-80 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:bg-slate-900 dark:border-slate-800 z-40">
                        {marketResults.map((result) => (
                            <li key={result.symbol} className="flex cursor-default items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg dark:hover:bg-slate-800">
                                <div>
                                    <div className="font-bold text-sm text-slate-900 dark:text-white">{result.symbol}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{result.name}</div>
                                </div>
                                <span className="text-[10px] font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 dark:bg-slate-800 dark:text-slate-400">{result.type}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )}

        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          
          <Link href="/dashboard/alerts">
            <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition">
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-900 animate-pulse"></span>
                )}
            </button>
          </Link>
        </div>

        <div className="relative">
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 md:gap-3 rounded-full border border-slate-200 bg-white p-1 pr-2 md:pr-4 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden dark:bg-indigo-900 dark:text-indigo-300">
                    {loading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-400" />
                    ) : user?.avatar_url ? (
                        <img src={user.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                        <User className="h-5 w-5" />
                    )}
                </div>
                <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-semibold text-slate-700 leading-none dark:text-slate-200">
                        {loading ? 'Loading...' : (user?.full_name || 'User')}
                    </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-slate-800 dark:bg-slate-900 z-20">
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.full_name || 'My Account'}</p>
                            <p className="text-xs text-slate-500 truncate dark:text-slate-400">{user?.email}</p>
                        </div>
                        <Link href="/dashboard/settings" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                            <Settings className="h-4 w-4" /> Account Settings
                        </Link>
                        <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                            <CreditCard className="h-4 w-4" /> Billing & Plans
                        </button>
                        <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                            <HelpCircle className="h-4 w-4" /> Help & Support
                        </button>
                        <div className="my-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                        <button onClick={handleSignOut} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-slate-800">
                            <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                    </div>
                </>
            )}
        </div>
      </div>
    </header>
  )
}