'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'
import { Loader2, Target, TrendingUp, Calculator, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart } from 'recharts'

export default function GoalsPage() {
  const { selectedPortfolio } = usePortfolio()
  const [loading, setLoading] = useState(true)
  
  // Financial State
  const [currentNetWorth, setCurrentNetWorth] = useState(0)
  
  // Goal Inputs
  const [targetAmount, setTargetAmount] = useState(10000000) // 1 Crore default
  const [years, setYears] = useState(10)
  const [expectedReturn, setExpectedReturn] = useState(12) // 12% default
  const [monthlySip, setMonthlySip] = useState(50000)
  
  // Results
  const [projection, setProjection] = useState<any[]>([])
  const [projectedWealth, setProjectedWealth] = useState(0)
  const [shortfall, setShortfall] = useState(0)

  const supabase = createClient()

  // 1. Fetch Current Net Worth
  useEffect(() => {
    const fetchWealth = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let query = supabase.from('transactions').select(`*, assets ( ticker )`)
        if (selectedPortfolio.id !== 'all') query = query.eq('portfolio_id', selectedPortfolio.id)
        const { data: txns } = await query
        
        if (txns) {
            const holdings: Record<string, number> = {}
            txns.forEach((t: any) => {
                if (t.transaction_type === 'Buy') holdings[t.assets.ticker] = (holdings[t.assets.ticker] || 0) + Number(t.quantity)
                else if (t.transaction_type === 'Sell') holdings[t.assets.ticker] = (holdings[t.assets.ticker] || 0) - Number(t.quantity)
            })
            
            const tickers = Object.keys(holdings).filter(k => holdings[k] > 0)
            if (tickers.length > 0) {
                const res = await fetch('/api/prices', { method: 'POST', body: JSON.stringify({ tickers }) })
                const prices = await res.json()
                let total = 0
                tickers.forEach(t => {
                     const price = prices[t] || 0
                     total += (holdings[t] * price)
                })
                setCurrentNetWorth(total)
            }
        }
      } catch (e) { console.error(e) } 
      finally { setLoading(false) }
    }
    fetchWealth()
  }, [selectedPortfolio])

  // 2. Calculate Projection
  useEffect(() => {
      const monthlyRate = expectedReturn / 100 / 12
      const months = years * 12
      const data = []
      
      let wealth = currentNetWorth
      let invested = currentNetWorth 

      for (let i = 1; i <= months; i++) {
          wealth = (wealth + monthlySip) * (1 + monthlyRate)
          invested += monthlySip

          if (i % 12 === 0) { 
              data.push({
                  year: `Year ${i/12}`,
                  invested: Math.round(invested),
                  wealth: Math.round(wealth),
                  target: targetAmount 
              })
          }
      }

      setProjection(data)
      setProjectedWealth(wealth)
      setShortfall(targetAmount - wealth)

  }, [currentNetWorth, targetAmount, years, expectedReturn, monthlySip])

  // --- SMART INPUT HANDLER ---
  const handleFormattedInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: number) => void) => {
      // Remove non-digits (commas)
      const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '')
      if (rawValue === '') {
          setter(0)
          return
      }
      setter(Number(rawValue))
  }

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  const isGoalMet = projectedWealth >= targetAmount

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* STATUS BAR */}
      <div className={`w-full px-6 py-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${isGoalMet ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isGoalMet ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <Target className="h-5 w-5" />
              </div>
              <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Projected Outcome</div>
                  <div className="text-lg font-bold">
                      {isGoalMet ? "Goal Achieved! 🎉" : `Shortfall: ₹${Math.abs(shortfall).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  </div>
              </div>
          </div>
          
          {!isGoalMet && (
              <div className="text-sm font-medium opacity-90 bg-white/50 px-3 py-1.5 rounded-lg">
                  Tip: Increase SIP by ₹{Math.round(Math.abs(shortfall) / (years * 12)).toLocaleString('en-IN')} to hit goal.
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* INPUTS PANEL */}
          <div className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 h-fit">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Configuration
              </h3>
              
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Target Amount (₹)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={targetAmount > 0 ? targetAmount.toLocaleString('en-IN') : ''} 
                    onChange={(e) => handleFormattedInput(e, setTargetAmount)} 
                    className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono focus:border-indigo-500 focus:outline-none" 
                    placeholder="0"
                  />
              </div>

              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Monthly SIP (₹)</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={monthlySip > 0 ? monthlySip.toLocaleString('en-IN') : ''} 
                    onChange={(e) => handleFormattedInput(e, setMonthlySip)} 
                    className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono focus:border-indigo-500 focus:outline-none"
                    placeholder="0"
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Time (Years)</label>
                    <input type="number" value={years} onChange={e => setYears(Number(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Exp. Return (%)</label>
                    <input type="number" value={expectedReturn} onChange={e => setExpectedReturn(Number(e.target.value))} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-500">Current Net Worth:</span>
                      <span className="font-mono font-medium">₹{currentNetWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Projected Wealth:</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">₹{projectedWealth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
              </div>
          </div>

          {/* CHART PANEL */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-6">Wealth Projection Curve</h3>
              <div className="flex-1 h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projection} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                        <YAxis 
                            hide={false} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#94a3b8'}} 
                            tickFormatter={(val) => `₹${(val/10000000).toFixed(1)}Cr`} 
                            width={50}
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, '']}
                        />
                        <Legend verticalAlign="top" height={36}/>
                        
                        <Area type="monotone" dataKey="wealth" name="Projected Wealth" stroke="#6366f1" fill="url(#colorWealth)" strokeWidth={3} />
                        <Area type="monotone" dataKey="invested" name="Total Invested" stroke="#94a3b8" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="target" name="Target Goal" stroke="#10b981" strokeWidth={2} dot={false} />
                    </AreaChart>
                </ResponsiveContainer>
              </div>
          </div>

      </div>
    </div>
  )
}