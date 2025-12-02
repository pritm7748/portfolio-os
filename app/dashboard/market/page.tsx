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
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    // Allow natural page scroll (min-h-screen), flex layout for side-by-side
    <div className="flex flex-col lg:flex-row gap-6 relative items-start min-h-screen">
      
      {/* LEFT SIDE: INDICES LIST */}
      <div className="flex-1 w-full min-w-0">
        
        {/* Sticky Search Bar */}
        <div className="mb-6 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 pt-2 pb-2">
             <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search indices..."
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-8 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-2.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
             </div>
        </div>

        {/* List Content */}
        <div className="pb-20">
            {highlights.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Market Overview</h2>
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
                </div>
            )}

            {secondary.length > 0 && (
                <div>
                    <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Sectors & Themes</h3>
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
        </div>
      </div>

      {/* RIGHT SIDE: CONSTITUENTS PANEL */}
      {selectedSector && (
        <>
            {/* Mobile: Full Screen Overlay */}
            <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col lg:hidden animate-in slide-in-from-bottom duration-200">
                <div className="flex-1 overflow-hidden">
                    <MarketConstituents 
                        indexName={selectedName} 
                        tickers={selectedTickers} 
                        onClose={handleClose}
                        filterText={searchQuery} 
                    />
                </div>
            </div>

            {/* Desktop: Sticky Side Panel */}
            {/* sticky top-4 keeps it pinned. h-[calc] ensures internal scrollbar. */}
            <div className="hidden lg:block w-96 flex-shrink-0 sticky top-4 h-[calc(100vh-2rem)]">
                <div className="h-full overflow-hidden rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <MarketConstituents 
                        indexName={selectedName} 
                        tickers={selectedTickers} 
                        onClose={handleClose}
                        filterText={searchQuery} 
                    />
                </div>
            </div>
        </>
      )}

    </div>
  )
}