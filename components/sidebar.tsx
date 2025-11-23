// components/sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, PieChart, Wallet, TrendingUp, FileText, Settings, List, LogOut, 
  ChevronDown, Plus, Briefcase
} from 'lucide-react'
import { usePortfolio } from '@/context/portfolio-context' 
import { useState, useEffect } from 'react' // <--- Added useEffect
import { createClient } from '@/lib/supabase/client'

const sidebarLinks = [
  {
    heading: 'User Panel',
    links: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/dashboard/holdings', icon: Wallet, label: 'Holdings' },
      { href: '/dashboard/analytics', icon: PieChart, label: 'Analytics' },
      { href: '/dashboard/market', icon: TrendingUp, label: 'Market' },
      { href: '/dashboard/watchlist', icon: List, label: 'Watchlist' },
      { href: '/dashboard/reports', icon: FileText, label: 'Reports' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { portfolios, selectedPortfolio, selectPortfolio, refreshPortfolios } = usePortfolio()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const supabase = createClient()

  // --- THE FIX: Close dropdown on navigation ---
  useEffect(() => {
    setIsDropdownOpen(false)
  }, [pathname]) 

  const handleCreatePortfolio = async () => {
    const name = prompt("Enter portfolio name (e.g., 'Retirement'):")
    if (!name) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('portfolios').insert({ user_id: user.id, name })
    if (error) alert(error.message)
    else {
        refreshPortfolios()
        setIsDropdownOpen(false)
    }
  }

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white text-slate-900 md:flex dark:border-slate-800 dark:bg-slate-900 dark:text-white font-sans">
      
      {/* Logo Area */}
      <div className="flex h-20 items-center px-6 border-b border-slate-200 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-2xl text-indigo-600 dark:text-indigo-400">
          <TrendingUp className="h-8 w-8" />
          <span>PortfolioOS</span>
        </Link>
      </div>

      {/* PORTFOLIO SWITCHER */}
      {portfolios.length > 1 ? (
        <div className="p-4 pb-0">
            <div className="relative">
                <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-indigo-500" />
                        <span className="truncate max-w-[120px]">{selectedPortfolio.name}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>

                {isDropdownOpen && (
                    <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <button
                            onClick={() => { selectPortfolio({ id: 'all', name: 'All Portfolios' }); setIsDropdownOpen(false) }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-indigo-900/30"
                        >
                            All Portfolios
                        </button>
                        {portfolios.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { selectPortfolio(p); setIsDropdownOpen(false) }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-indigo-900/30"
                            >
                                {p.name}
                            </button>
                        ))}
                        <div className="my-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                        <button
                            onClick={handleCreatePortfolio}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                        >
                            <Plus className="h-4 w-4" />
                            New Portfolio
                        </button>
                    </div>
                )}
            </div>
        </div>
      ) : (
        <div className="p-4 pb-0">
             <button
                onClick={handleCreatePortfolio}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-2 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-indigo-400"
            >
                <Plus className="h-3 w-3" /> Create Portfolio
            </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4">
        {sidebarLinks.map((section, index) => (
          <div key={index} className="mb-6">
            <h3 className="px-6 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              {section.heading}
            </h3>
            <ul className="space-y-1">
              {section.links.map((link) => {
                const isActive = pathname === link.href
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors relative
                        ${isActive
                          ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                        }
                      `}
                    >
                      {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-indigo-600 dark:bg-indigo-400" />}
                      <link.icon className="h-5 w-5" />
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <ul className="space-y-1">
          <li>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
          </li>
          <li>
            <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400">
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}