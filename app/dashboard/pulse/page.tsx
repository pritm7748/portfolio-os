'use client'

import { useMemo, useState } from 'react'
import { useTransactions, usePulse } from '@/hooks/use-portfolio-data'
import { Loader2, Calendar, TrendingUp, TrendingDown, Briefcase, Zap, Globe, Activity, HelpCircle, Gift, FileText, ArrowRightLeft, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react'

// --- 1. ADVANCED TRANSACTION CLASSIFIER ---
const getTransactionType = (txn: any) => {
    // Normalize text: combine action + any raw text available, lowercased
    const raw = (txn.action || '').toLowerCase().trim()
    const shares = Number(txn.shares) || 0

    // Helper for regex matching
    const matches = (regex: RegExp) => regex.test(raw)

    // A. MARKET TRADES (The most common, explicit ones)
    if (matches(/(open market|market purchase|creeping acquisition)/)) 
        return { label: 'Market Buy', color: 'text-green-600', icon: TrendingUp }
    
    if (matches(/(open market sale|market sale|market disposal)/)) 
        return { label: 'Market Sell', color: 'text-red-600', icon: TrendingDown }

    // B. PLEDGE ACTIVITIES (Promoter Funding)
    if (matches(/pledge.*creat/)) return { label: 'Pledge Created', color: 'text-red-500', icon: Lock }
    if (matches(/pledge.*(revok|release|clos)/)) return { label: 'Pledge Revoked', color: 'text-green-500', icon: Unlock }
    if (matches(/pledge.*invo/)) return { label: 'Pledge Invoked', color: 'text-red-700', icon: TrendingDown }

    // C. OFF-MARKET & TRANSFERS
    // Catches "Other at price..." which usually means non-open-market allotment
    if (matches(/other at price/)) return { label: 'Off-Market / Allotment', color: 'text-indigo-600', icon: FileText }
    if (matches(/(inter-se|inter se|transfer)/)) return { label: 'Inter-se Transfer', color: 'text-slate-500', icon: ArrowRightLeft }
    if (matches(/(gift|donation)/)) return { label: 'Gift', color: 'text-pink-500', icon: Gift }
    if (matches(/off market/)) return { label: 'Off-Market Trade', color: 'text-slate-600', icon: ArrowRightLeft }

    // D. CORPORATE ACTIONS
    if (matches(/(allotment|preferential|warrant)/)) return { label: 'Pref. Allotment', color: 'text-indigo-600', icon: FileText }
    if (matches(/(esop|exercise|vest)/)) return { label: 'ESOP Exercise', color: 'text-amber-600', icon: FileText }
    if (matches(/bonus/)) return { label: 'Bonus Issue', color: 'text-indigo-600', icon: Gift }
    if (matches(/rights/)) return { label: 'Rights Issue', color: 'text-indigo-600', icon: FileText }

    // E. GENERIC FALLBACKS (If no specific context found)
    if (matches(/(buy|bought|purchase|acqui)/)) return { label: 'Buy', color: 'text-green-600', icon: TrendingUp }
    if (matches(/(sell|sold|sale|dispos)/)) return { label: 'Sell', color: 'text-red-600', icon: TrendingDown }

    // F. UNKNOWN / EMPTY / "Other"
    // If we have shares direction, assume Accumulate/Dispose
    if (shares > 0) return { label: 'Accumulate', color: 'text-green-600', icon: TrendingUp }
    if (shares < 0) return { label: 'Dispose', color: 'text-red-600', icon: TrendingDown }

    return { 
        label: 'Update', 
        color: 'text-slate-500', 
        icon: HelpCircle 
    }
}

// --- 2. RESPONSIVE SECTION COMPONENT ---
const Section = ({ title, icon: Icon, children, isOpen, onToggle }: any) => {
    return (
        <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm h-fit">
            
            {/* MOBILE HEADER (Collapsible) - Hidden on Desktop */}
            <button 
                onClick={onToggle}
                className="md:hidden w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50"
            >
                <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-indigo-500" /> {title}
                </span>
                {isOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>

            {/* DESKTOP HEADER (Static) - Hidden on Mobile */}
            <div className="hidden md:flex p-4 pb-0 items-center gap-2 mb-4 border-b-0">
                <Icon className="h-5 w-5 text-indigo-500" /> 
                <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
            </div>
            
            {/* CONTENT AREA */}
            {/* On Mobile: Hidden unless 'isOpen'. On Desktop: Always 'block' */}
            <div className={`${isOpen ? 'block' : 'hidden'} md:block p-4 pt-0 border-t border-slate-100 md:border-0 dark:border-slate-800 animate-in slide-in-from-top-1`}>
                {children}
            </div>
        </div>
    )
}

export default function PulsePage() {
  const { data: transactions } = useTransactions()
  
  // Mobile Accordion State (Open 'radar' by default)
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
      
      {/* 1. MACRO DASHBOARD (Grid on all screens) */}
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

      {/* 2. CONTENT SECTIONS (Column on Mobile, Grid on Desktop) */}
      <div className="flex flex-col md:grid md:grid-cols-3 gap-6">
          
          {/* SECTION 1: BIG MONEY RADAR */}
          <Section 
            title="Big Money Radar" 
            icon={Zap} 
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
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[150px]" title={txn.holder}>
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