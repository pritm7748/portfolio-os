'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import TechnicalChart from '@/components/technical-chart'

export default function ChartsPage() {
  const [symbol, setSymbol] = useState('NIFTY 50')
  const [inputValue, setInputValue] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
        setSymbol(inputValue.toUpperCase())
        setInputValue('')
    }
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Advanced Charts</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Technical analysis with indicators and intraday data.</p>
        </div>

        <form onSubmit={handleSearch} className="relative w-full md:w-80">
            <input 
                type="text" 
                placeholder="Search symbol (e.g. TCS, INFY)..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        </form>
      </div>

      {/* The Chart */}
      <div className="animate-in slide-in-from-bottom-4 duration-500">
        <TechnicalChart symbol={symbol} />
      </div>

    </div>
  )
}