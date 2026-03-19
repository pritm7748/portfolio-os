// components/header-title.tsx
'use client'

import { usePathname } from 'next/navigation'

export default function HeaderTitle() {
  const pathname = usePathname()

  // Map paths to Titles
  const getTitle = () => {
    if (pathname.includes('/analysis')) return 'Stock & MTF Analysis'
    if (pathname.includes('/holdings')) return 'Holdings'
    if (pathname.includes('/analytics')) return 'Analytics'
    if (pathname.includes('/watchlist')) return 'Watchlist'
    if (pathname.includes('/reports')) return 'Reports'
    if (pathname.includes('/settings')) return 'Account Settings'
    if (pathname.includes('/market')) return 'Market Status'
    if (pathname.includes('/news')) return 'News Center'
    if (pathname.includes('/pulse')) return 'Market Pulse'
    if (pathname.includes('/goals')) return 'Goals & Planning'
    return 'Dashboard' // Default
  }

  return (
    <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
      {getTitle()}
    </h1>
  )
}