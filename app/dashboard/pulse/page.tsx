'use client'

import { useMemo, useState } from 'react'
import { useTransactions, usePulse } from '@/hooks/use-portfolio-data'
import { Loader2, Calendar, TrendingUp, TrendingDown, Briefcase, Zap, Globe, Activity, HelpCircle, Gift, FileText, ArrowRightLeft, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react'

// --- 1. PRECISE TRANSACTION CLASSIFIER ---
const getTransactionType = (txn: any) => {
    const raw = (txn.action || '').toLowerCase().trim()
    
    // Helper to check keywords
    const has = (w: string) => raw.includes(w)

    // A. Explicit Market Trades
    if (has('market purchase') || has('open market') || has('creeping')) 
        return { label: 'Market Buy', color: 'text-green-600', icon: TrendingUp }
    
    if (has('market sale') || has('market disposal')) 
        return { label: 'Market Sell', color: 'text-red-600', icon: TrendingDown }

    // B. Pledges (Promoter Activity)
    if (has('pledge') && has('creation')) return { label: 'Pledge Created', color: 'text-red-500', icon: Lock }
    if (has('pledge') && (has('revocation') || has('release'))) return { label: 'Pledge Revoked', color: 'text-green-500', icon: Unlock }
    if (has('pledge') && has('invocation')) return { label: 'Pledge Invoked', color: 'text-red-700', icon: TrendingDown }

    // C. Transfers / Gifts / Off-Market
    if (has('inter-se') || has('transfer')) return { label: 'Inter-se Transfer', color: 'text-slate-500', icon: ArrowRightLeft }
    if (has('gift')) return { label: 'Gift', color: 'text-pink-500', icon: Gift }
    if (has('off market')) return { label: 'Off-Market Trade', color: 'text-slate-600', icon: ArrowRightLeft }

    // D. Corporate Actions
    if (has('allotment') || has('preferential')) return { label: 'Pref. Allotment', color: 'text-indigo-600', icon: FileText }
    if (has('esop') || has('exercise')) return { label: 'ESOP Exercise', color: 'text-amber-600', icon: FileText }

    // E. Fallbacks (Base logic)
    if (has('buy') || has('acquisition') || has('purchase')) return { label: 'Buy', color: 'text-green-600', icon: TrendingUp }
    if (has('sell') || has('sale') || has('disposal')) return { label: 'Sell', color: 'text-red-600', icon: TrendingDown }

    // F. Unknown - Show truncated text instead of "Unknown"
    return { 
        label: txn.action.length > 25 ? txn.action.substring(0, 22) + '...' : txn.action || 'Update', 
        color: 'text-slate-500', 
        icon: HelpCircle 
    }
}

// --- 2. MOBILE ACCORDION COMPONENT ---
const Section = ({ title, icon: Icon, children, isOpen, onToggle, isMobile }: any) => {
    if (!isMobile) {
        // Desktop: Always visible card
        return (
            <div className="space-y-4 h-full">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-indigo-500" /> {title}
                </h3>
                {children}
            </div>
        )
    }

    // Mobile: Collapsible Accordion
    return (
        <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm">
            <button 
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50"
            >
                <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-indigo-500" /> {title}
                </span>
                {isOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>
            
            {isOpen && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                    {children}
                </div>
            )}
        </div>
    )
}

export default function PulsePage() {
  const { data: transactions } = useTransactions()
  
  // Mobile Accordion State (Open 'Radar' by default)
  const [openSection, setOpenSection] = useState<string | null>('radar')

  const toggleSection = (id: string) => {
      setOpenSection(current => current === id ? null : id)
  }
  
  const allTickers = useMemo(() => {
      if (!transactions) return []
      return Array.from(new Set(transactions.map(t => t.assets.ticker)))
  }, [transactions])

  const { data, isLoading } = usePulse(allTickers)

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-8 pb-20">
      
      {/* 1. MACRO DASHBOARD (Always Visible) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {data?.macro?.map((m: any, i: number) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {m.type === 'Currency' ? <Globe className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                      {m.name}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {m.prefix}{m.price.toFixed(2)}{m.suffix}
                      </span>
                      <span className={`text-xs font-medium ${m.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {m.change > 0 ? '+' : ''}{m.change.toFixed(2)}%
                      </span>
                  </div>
              </div>
          ))}
      </div>

      {/* 2. CONTENT SECTIONS (Desktop: Grid, Mobile: Accordion Stack) */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
          
          {/* SECTION 1: BIG MONEY RADAR */}
          <Section 
            title="Big Money Radar" 
            icon={Zap} 
            isMobile={true} // Enable accordion logic
            isOpen={openSection === 'radar'} 
            onToggle={() => toggleSection('radar')}
          >
              <div className="space-y-3">
                  {!data?.shockers || data.shockers.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No unusual volume detected.</p>
                  ) : (
                      data.shockers.map((s: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 p-3 dark:bg-amber-900/10 dark:border-amber-900/30">
                              <div>
                                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{s.ticker}</h4>
                                  <span className={`text-xs font-medium ${s.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {s.change > 0 ? '+' : ''}{s.change.toFixed(2)}% Today
                                  </span>
                              </div>
                              <div className="text-right">
                                  <span className="block text-base font-bold text-amber-600 dark:text-amber-500">{s.ratio}</span>
                                  <span className="text-[10px] text-slate-500 uppercase">Vol vs Avg</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </Section>

          {/* SECTION 2: EVENT CALENDAR */}
          <Section 
            title="Upcoming Events" 
            icon={Calendar} 
            isMobile={true} 
            isOpen={openSection === 'events'} 
            onToggle={() => toggleSection('events')}
          >
              <div className="space-y-3">
                  {!data?.events || data.events.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No upcoming events.</p>
                  ) : (
                      data.events.map((event: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:bg-slate-800/30 dark:border-slate-800">
                              <div className="flex flex-col items-center justify-center rounded bg-white p-1.5 min-w-[45px] shadow-sm dark:bg-slate-900">
                                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                                      {new Date(event.date).toLocaleString('default', { month: 'short' })}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                                      {new Date(event.date).getDate()}
                                  </span>
                              </div>
                              <div>
                                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{event.ticker}</h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{event.desc}</p>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </Section>

          {/* SECTION 3: INSIDER ACTIVITY */}
          <Section 
            title="Insider Activity" 
            icon={Briefcase} 
            isMobile={true} 
            isOpen={openSection === 'insiders'} 
            onToggle={() => toggleSection('insiders')}
          >
              <div className="space-y-3">
                  {!data?.insiders || data.insiders.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No recent insider trades.</p>
                  ) : (
                      data.insiders.map((txn: any, i: number) => {
                          const { label, color, icon: Icon } = getTransactionType(txn)
                          return (
                              <div key={i} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{txn.ticker}</h4>
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[150px]">
                                              {txn.holder} ({txn.relation})
                                          </p>
                                      </div>
                                      <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded dark:bg-slate-800">
                                          {new Date(txn.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                      </span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                                      <div className="flex flex-col">
                                          <span className={`flex items-center gap-1 text-xs font-bold ${color}`}>
                                              <Icon className="h-3 w-3" /> {label}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                              {Math.abs(txn.shares) > 1000 ? (Math.abs(txn.shares) / 1000).toFixed(1) + 'k' : Math.abs(txn.shares)} Shares
                                          </span>
                                      </div>
                                      
                                      {txn.value > 0 ? (
                                          <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                                              {txn.value > 10000000 ? `₹${(txn.value / 10000000).toFixed(2)}Cr` : `₹${(txn.value / 100000).toFixed(2)}L`}
                                          </span>
                                      ) : (
                                          <span className="text-[10px] text-slate-400 italic">-</span>
                                      )}
                                  </div>
                              </div>
                          )
                      })
                  )}
              </div>
          </Section>

      </div>
    </div>
  )
}