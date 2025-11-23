'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import MarketCard from '@/components/market-card'
import MarketConstituents from '@/components/market-constituents'
import { INDICES, SECTOR_CONSTITUENTS } from '@/lib/market-data'

export default function MarketPage() {
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('') 
  
  const toggleSector = (ticker: string) => {
    if (selectedSector === ticker) {
        setSelectedSector(null)
    } else {
        setSelectedSector(ticker)
    }
  }

  const handleClose = () => {
      setSelectedSector(null)
  }

  // Filter Logic
  const filteredIndices = INDICES.filter(idx => 
    idx.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    idx.ticker.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const highlightsList = ['^NSEI', '^BSESN', '^NSEBANK', '^CNXIT']
  const highlights = filteredIndices.filter(i => highlightsList.includes(i.ticker))
  const secondary = filteredIndices.filter(i => !highlightsList.includes(i.ticker))

  const selectedTickers = selectedSector ? (SECTOR_CONSTITUENTS[selectedSector] || []) : []
  const selectedName = INDICES.find(i => i.ticker === selectedSector)?.name || 'Select Index'

  const gridClass = selectedSector 
    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' 
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start h-[calc(100vh-100px)]">
      
      {/* LEFT SIDE */}
      <div className="flex-1 overflow-y-auto pr-2 pb-10 h-full space-y-8 transition-all duration-300 ease-in-out">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Market Overview</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Live performance of Benchmark & Sectoral Indices.</p>
             </div>

             {/* SEARCH BAR WITH CLEAR BUTTON */}
             <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search indices..."
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-2.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
             </div>
        </div>

        {/* Main Indices */}
        {highlights.length > 0 && (
            <div className={`grid gap-4 transition-all duration-300 ${gridClass}`}>
                {highlights.map(idx => (
                    <MarketCard 
                        key={idx.ticker} 
                        name={idx.name} 
                        ticker={idx.ticker} 
                        onClick={() => toggleSector(idx.ticker)}
                        isSelected={selectedSector === idx.ticker}
                    />
                ))}
            </div>
        )}

        {/* Sectoral Indices */}
        {secondary.length > 0 && (
            <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Sectors & Themes</h3>
                <div className={`grid gap-4 transition-all duration-300 ${gridClass}`}>
                    {secondary.map(idx => (
                        <MarketCard 
                            key={idx.ticker} 
                            name={idx.name} 
                            ticker={idx.ticker} 
                            onClick={() => toggleSector(idx.ticker)}
                            isSelected={selectedSector === idx.ticker}
                        />
                    ))}
                </div>
            </div>
        )}

        {/* Empty State */}
        {highlights.length === 0 && secondary.length === 0 && (
            <div className="py-10 text-center text-slate-500">
                No indices found matching "{searchQuery}".
            </div>
        )}
      </div>

      {/* RIGHT SIDE */}
      {selectedSector && (
        <div className="w-full lg:w-96 h-full sticky top-0 flex flex-col animate-in slide-in-from-right duration-300">
            <MarketConstituents 
                indexName={selectedName} 
                tickers={selectedTickers} 
                onClose={handleClose}
                filterText={searchQuery} 
            />
        </div>
      )}

    </div>
  )
}