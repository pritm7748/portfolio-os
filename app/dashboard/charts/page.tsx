'use client'

import { useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import TechnicalChart from '@/components/technical-chart'
import { useActiveAssets } from '@/hooks/use-portfolio-data'

export default function ChartsPage() {
  const [symbol, setSymbol] = useState('NIFTY 50')
  const [inputValue, setInputValue] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Fetch user holdings for the dropdown
  const activeAssets = useActiveAssets()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
        setSymbol(inputValue.toUpperCase())
        setInputValue('')
        setIsDropdownOpen(false)
    }
  }

  const selectAsset = (ticker: string) => {
      setSymbol(ticker)
      setIsDropdownOpen(false)
  }

  return (
    <div className="space-y-4 pb-20 h-[calc(100vh-100px)] flex flex-col">
      
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        
        {/* Quick Select Dropdown */}
        <div className="relative w-full md:w-64 z-20">
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-indigo-500 transition-colors"
            >
                <span className="truncate">{symbol}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full max-h-80 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Indices</span>
                    </div>
                    {['NIFTY 50', 'SENSEX', 'BANKNIFTY'].map(idx => (
                        <button key={idx} onClick={() => selectAsset(idx)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                            {idx}
                        </button>
                    ))}

                    {activeAssets.length > 0 && (
                        <>
                            <div className="p-2 border-b border-slate-100 dark:border-slate-800 mt-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">My Assets</span>
                            </div>
                            {activeAssets.map(asset => (
                                <button key={asset.ticker} onClick={() => selectAsset(asset.ticker)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex justify-between items-center group">
                                    <span>{asset.ticker}</span>
                                    <span className="text-[10px] text-slate-400 group-hover:text-indigo-500">{asset.type}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative flex-1">
            <input 
                type="text" 
                placeholder="Search any symbol (e.g. RELIANCE, TATAMOTORS)..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        </form>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative animate-in fade-in duration-500">
        <TechnicalChart symbol={symbol} />
      </div>

    </div>
  )
}