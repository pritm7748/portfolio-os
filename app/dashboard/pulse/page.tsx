'use client'

import { useMemo, useState } from 'react'
import { useTransactions, usePulse } from '@/hooks/use-portfolio-data'
import { 
    Loader2, Calendar, TrendingUp, TrendingDown, Briefcase, Zap, Globe, Activity, 
    HelpCircle, Gift, FileText, ArrowRightLeft, ChevronDown, ChevronUp, Lock, Unlock, 
    AlertTriangle, ShieldCheck, RefreshCcw, Layers 
} from 'lucide-react'

// --- 1. FORENSIC TRANSACTION CLASSIFIER (SEBI Optimized) ---
const getTransactionType = (txn: any) => {
    // Clean inputs
    const raw = (txn.action || '').toLowerCase().trim()
    const shares = Number(txn.shares) || 0
    const value = Number(txn.value) || 0
    const price = shares !== 0 ? Math.abs(value / shares) : 0

    // Helper: Regex Matcher
    const is = (pattern: RegExp) => pattern.test(raw)

    // --- PRIORITY 1: BLOCK & BULK DEALS (High Impact) ---
    if (is(/block deal|bulk deal/)) {
        if (is(/sale|sold|dispos/)) return { label: 'Block Deal (Sell)', color: 'text-red-700 bg-red-50', icon: Layers }
        if (is(/purchase|buy|acqui/)) return { label: 'Block Deal (Buy)', color: 'text-green-700 bg-green-50', icon: Layers }
        return { label: 'Block Deal', color: 'text-indigo-700 bg-indigo-50', icon: Layers }
    }

    // --- PRIORITY 2: PLEDGES (Promoter Risk) ---
    if (is(/invok/)) return { label: 'Pledge Invoked', color: 'text-red-700 bg-red-50', icon: AlertTriangle } // Danger
    if (is(/revok|release|clos/)) return { label: 'Pledge Revoked', color: 'text-green-600 bg-green-50', icon: Unlock } // Good
    if (is(/creat|pledge/)) return { label: 'Pledge Created', color: 'text-orange-600 bg-orange-50', icon: Lock } // Caution

    // --- PRIORITY 3: CORPORATE ACTIONS & CONVERSIONS ---
    if (is(/conversion|convert|ccd|debenture/)) return { label: 'Securities Conversion', color: 'text-blue-600 bg-blue-50', icon: RefreshCcw }
    if (is(/esop|exercise|vest|employee/)) return { label: 'ESOP Exercise', color: 'text-blue-600 bg-blue-50', icon: FileText }
    if (is(/rights/)) return { label: 'Rights Issue', color: 'text-indigo-600 bg-indigo-50', icon: FileText }
    if (is(/bonus/)) return { label: 'Bonus Issue', color: 'text-indigo-600 bg-indigo-50', icon: Gift }
    if (is(/buyback/)) return { label: 'Share Buyback', color: 'text-indigo-600 bg-indigo-50', icon: RefreshCcw }
    if (is(/allotment|preferential|warrant/)) return { label: 'Pref. Allotment', color: 'text-indigo-600 bg-indigo-50', icon: ShieldCheck }

    // --- PRIORITY 4: TRANSFERS (Non-Market) ---
    if (is(/gift|donat/)) return { label: 'Gift / Donation', color: 'text-pink-600 bg-pink-50', icon: Gift }
    if (is(/inter-se|inter se/)) return { label: 'Inter-se Transfer', color: 'text-slate-600 bg-slate-100', icon: ArrowRightLeft }
    if (is(/off market|off-market/)) return { label: 'Off-Market Deal', color: 'text-slate-600 bg-slate-100', icon: ArrowRightLeft }
    if (is(/transfer|transmission/)) return { label: 'Transfer', color: 'text-slate-600 bg-slate-100', icon: ArrowRightLeft }

    // --- PRIORITY 5: EXPLICIT MARKET TRADES ---
    // Note: We prioritize TEXT over share sign because APIs mess up signs often.
    if (is(/market sale|open market sale/)) return { label: 'Market Sell', color: 'text-red-600 bg-red-50', icon: TrendingDown }
    if (is(/dispos|sell|sold|sale|divest/)) return { label: 'Market Sell', color: 'text-red-600 bg-red-50', icon: TrendingDown } // Catches "Divestment"

    if (is(/creeping/)) return { label: 'Creeping Acq.', color: 'text-green-700 bg-green-50', icon: TrendingUp }
    if (is(/market purchase|open market/)) return { label: 'Market Buy', color: 'text-green-600 bg-green-50', icon: TrendingUp }
    if (is(/acqui|buy|bought|purchase|subscri/)) return { label: 'Market Buy', color: 'text-green-600 bg-green-50', icon: TrendingUp }

    // --- PRIORITY 6: FALLBACKS (Smart Guessing for "Other") ---
    
    // Case: "Other at price 0.0..." -> Usually a Pledge Revocation or Gift
    if (is(/other/) && price < 0.5) {
        return { label: 'Non-Market Move', color: 'text-slate-500 bg-slate-100', icon: Activity }
    }

    // Case: Huge Volume with no text -> Usually a Holding Statement Update
    if (Math.abs(shares) > 10000000 && value === 0) {
        return { label: 'Holding Update', color: 'text-slate-400 bg-slate-50', icon: FileText }
    }

    // Directional Fallback
    if (shares > 0) return { label: 'Strategic Add', color: 'text-teal-600 bg-teal-50', icon: TrendingUp }
    if (shares < 0) return { label: 'Strategic Sell', color: 'text-orange-600 bg-orange-50', icon: TrendingDown }

    // Last Resort: Truncate raw text
    const cleanText = txn.action.replace(/acquisition|disposal|shares|of/gi, '').trim()
    return { 
        label: cleanText.length > 20 ? 'Update' : (cleanText || 'Reporting'), 
        color: 'text-slate-500 bg-slate-50', 
        icon: HelpCircle 
    }
}

// --- 2. RESPONSIVE SECTION COMPONENT ---
const Section = ({ title, icon: Icon, children, isOpen, onToggle }: any) => {
    return (
        <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden shadow-sm h-fit">
            
            {/* MOBILE: Clickable Header (Accordion) */}
            <button 
                onClick={onToggle}
                className="md:hidden w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50"
            >
                <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-indigo-500" /> {title}
                </span>
                {isOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>

            {/* DESKTOP: Static Header (Always Visible) */}
            <div className="hidden md:flex p-4 pb-3 items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                <Icon className="h-5 w-5 text-indigo-500" /> 
                <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
            </div>
            
            {/* CONTENT: Hidden on Mobile if closed, Always visible on Desktop */}
            <div className={`
                ${isOpen ? 'block' : 'hidden'} 
                md:block 
                p-4 
                animate-in slide-in-from-top-2 md:animate-none
            `}>
                {children}
            </div>
        </div>
    )
}

export default function PulsePage() {
  const { data: transactions } = useTransactions()
  
  // Mobile Accordion State
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
      
      {/* 1. MACRO DASHBOARD */}
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

      {/* 2. CONTENT SECTIONS */}
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
                      <div className="text-center py-8">
                          <p className="text-sm text-slate-400">No unusual volume detected.</p>
                      </div>
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
                      <div className="text-center py-8">
                          <p className="text-sm text-slate-400">No upcoming events.</p>
                      </div>
                  ) : (
                      data.events.map((event: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 dark:bg-slate-900 dark:border-slate-800">
                              <div className="flex flex-col items-center justify-center rounded-md bg-indigo-50 p-2 min-w-[48px] dark:bg-indigo-900/20">
                                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                                      {new Date(event.date).toLocaleString('default', { month: 'short' })}
                                  </span>
                                  <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">
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

          {/* SECTION 3: INSIDER ACTIVITY (FORENSIC CLASSIFIER) */}
          <Section 
            title="Insider Activity" 
            icon={Briefcase} 
            isOpen={openSection === 'insiders'} 
            onToggle={() => toggleSection('insiders')}
          >
              <div className="space-y-3">
                  {!data?.insiders || data.insiders.length === 0 ? (
                      <div className="text-center py-8">
                          <p className="text-sm text-slate-400">No recent insider trades.</p>
                      </div>
                  ) : (
                      data.insiders.map((txn: any, i: number) => {
                          const { label, color, icon: Icon } = getTransactionType(txn)
                          return (
                              <div key={i} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                                  {/* Header: Stock & Date */}
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1 min-w-0 mr-2">
                                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{txn.ticker}</h4>
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1" title={txn.holder}>
                                              {txn.holder} <span className="opacity-70">({txn.relation})</span>
                                          </p>
                                      </div>
                                      <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded dark:bg-slate-800">
                                          {new Date(txn.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                      </span>
                                  </div>
                                  
                                  {/* Footer: Action & Value */}
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                                      <div className="flex items-center gap-2">
                                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${color}`}>
                                              <Icon className="h-3 w-3" /> {label}
                                          </span>
                                      </div>
                                      
                                      <div className="text-right">
                                          {/* Logic to hide Value for Non-Monetary Actions */}
                                          {txn.value > 0 && !label.includes('Update') && !label.includes('Pledge') ? (
                                              <span className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                                  {txn.value > 10000000 ? `₹${(txn.value / 10000000).toFixed(2)}Cr` : `₹${(txn.value / 100000).toFixed(2)}L`}
                                              </span>
                                          ) : (
                                              <span className="block text-[10px] text-slate-400 italic">Reported</span>
                                          )}
                                          <span className="block text-[9px] text-slate-400 font-medium">
                                              {Math.abs(txn.shares) > 1000 ? (Math.abs(txn.shares) / 1000).toFixed(1) + 'k' : Math.abs(txn.shares)} Shares
                                          </span>
                                      </div>
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