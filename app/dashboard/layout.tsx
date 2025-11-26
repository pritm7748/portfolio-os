'use client'

import { useState } from 'react'
import Sidebar from '@/components/sidebar'
import Header from '@/components/header'
import LiveAlertMonitor from '@/components/live-alert-monitor' // <--- Import

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden">
      
      {/* ACTIVATE BACKGROUND MONITOR */}
      <LiveAlertMonitor />

      <Sidebar 
        mobileOpen={isMobileMenuOpen} 
        setMobileOpen={setIsMobileMenuOpen} 
      />

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {children}
        </main>
      </div>
    </div>
  )
}