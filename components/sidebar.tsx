'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, PieChart, Wallet, TrendingUp, FileText, Settings, List, LogOut, 
  ChevronDown, Plus, Briefcase, X, Edit2, Trash2, Target,
  Newspaper,
  Megaphone
} from 'lucide-react'
import { usePortfolio } from '@/context/portfolio-context' 
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Flattened list - removed "User Panel" heading
const mainLinks = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/holdings', icon: Wallet, label: 'Holdings' },
  { href: '/dashboard/analytics', icon: PieChart, label: 'Analytics' },
  { href: '/dashboard/goals', icon: Target, label: 'Goals & Planning' }, 
  { href: '/dashboard/market', icon: TrendingUp, label: 'Market' },
  { href: '/dashboard/watchlist', icon: List, label: 'Watchlist' },
  { href: '/dashboard/reports', icon: FileText, label: 'Reports' },
  { href: '/dashboard/news', icon: Newspaper, label: 'News Center' },
  { href: '/dashboard/pulse', icon: Megaphone, label: 'Market Pulse' },
]

export default function Sidebar({ 
    mobileOpen, 
    setMobileOpen 
}: { 
    mobileOpen: boolean, 
    setMobileOpen: (open: boolean) => void 
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { portfolios, selectedPortfolio, selectPortfolio, refreshPortfolios } = usePortfolio()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const supabase = createClient()

  // Close dropdown and sidebar on route change
  useEffect(() => {
    setIsDropdownOpen(false)
    if (window.innerWidth < 768) {
        setMobileOpen(false)
    }
  }, [pathname]) 

  // --- CREATE ---
  const handleCreatePortfolio = async () => {
    const name = prompt("Enter portfolio name (e.g., 'Retirement'):")
    if (!name) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('portfolios').insert({ user_id: user.id, name })
    if (error) alert(error.message)
    else {
        refreshPortfolios()
    }
  }

  // --- RENAME ---
  const handleRenamePortfolio = async (e: React.MouseEvent, id: number, currentName: string) => {
    e.stopPropagation()
    const newName = prompt("Rename portfolio:", currentName)
    if (!newName || newName === currentName) return

    const { error } = await supabase.from('portfolios').update({ name: newName }).eq('id', id)

    if (error) alert(error.message)
    else {
        refreshPortfolios()
        if (selectedPortfolio.id === id) {
            selectPortfolio({ id, name: newName })
        }
    }
  }

  // --- DELETE ---
  const handleDeletePortfolio = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    
    if (portfolios.length <= 1) {
        alert("You must have at least one portfolio. Create another before deleting this one.")
        return
    }

    if (!confirm("Are you sure? This will delete ALL transactions associated with this portfolio. This cannot be undone.")) return

    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    
    if (error) {
        alert(error.message)
    } else {
        if (selectedPortfolio.id === id) {
            selectPortfolio({ id: 'all', name: 'All Portfolios' })
        }
        refreshPortfolios()
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <>
        {/* Mobile Backdrop */}
        {mobileOpen && (
            <div 
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                onClick={() => setMobileOpen(false)}
            />
        )}

        {/* Sidebar Container */}
        <aside className={`
            fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-slate-200 bg-white text-slate-900 transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900 dark:text-white font-sans
            md:static md:translate-x-0 
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
        
        {/* Logo Area */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-2xl text-indigo-600 dark:text-indigo-400">
            <TrendingUp className="h-8 w-8" />
            <span>PortfolioOS</span>
            </Link>
            {/* Mobile Close Button */}
            <button onClick={() => setMobileOpen(false)} className="md:hidden p-1 text-slate-500 hover:bg-slate-100 rounded-md dark:hover:bg-slate-800">
                <X className="h-6 w-6" />
            </button>
        </div>

        {/* PORTFOLIO SWITCHER */}
        <div className="p-4 pb-0">
            {portfolios.length > 0 ? (
                <div className="relative">
                    <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-white rounded-md shadow-sm dark:bg-slate-700">
                                <Briefcase className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                            </div>
                            <span className="truncate max-w-[100px]">{selectedPortfolio.name}</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100">
                            
                            {/* Option: All Portfolios */}
                            <button
                                onClick={() => { selectPortfolio({ id: 'all', name: 'All Portfolios' }); setIsDropdownOpen(false) }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                <span className="flex-1 text-left font-medium">All Portfolios</span>
                            </button>

                            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                            
                            {/* List of Portfolios with Edit/Delete */}
                            <div className="max-h-48 overflow-y-auto scrollbar-thin">
                                {portfolios.map(p => (
                                    <div 
                                        key={p.id}
                                        onClick={() => { selectPortfolio(p); setIsDropdownOpen(false) }}
                                        className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer dark:text-slate-300 dark:hover:bg-indigo-900/30 transition-colors"
                                    >
                                        <span className="truncate max-w-[110px]">{p.name}</span>
                                        
                                        {/* Action Buttons (Visible on Hover) */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => handleRenamePortfolio(e, p.id as number, p.name)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded dark:hover:bg-blue-900/50"
                                                title="Rename"
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeletePortfolio(e, p.id as number)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded dark:hover:bg-red-900/50"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                            
                            <button
                                onClick={handleCreatePortfolio}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                New Portfolio
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    onClick={handleCreatePortfolio}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-3 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-indigo-400 transition-all"
                >
                    <Plus className="h-4 w-4" /> Create Portfolio
                </button>
            )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 px-4">
            <ul className="space-y-1.5">
                {mainLinks.map((link) => {
                    const isActive = pathname === link.href
                    return (
                    <li key={link.href}>
                        <Link
                        href={link.href}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all relative
                            ${isActive
                            ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white'
                            }
                        `}
                        >
                        <link.icon className={`h-5 w-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                        {link.label}
                        </Link>
                    </li>
                    )
                })}
            </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <ul className="space-y-1">
            <li>
                <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white"
                >
                <Settings className="h-5 w-5 text-slate-400" />
                Settings
                </Link>
            </li>
            <li>
                <button 
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/10 dark:hover:text-red-400"
                >
                <LogOut className="h-5 w-5" />
                Sign Out
                </button>
            </li>
            </ul>
        </div>
        </aside>
    </>
  )
}