// app/dashboard/market/page.tsx
'use client'

import { useState } from 'react'
import { Search, X, ArrowLeft } from 'lucide-react'
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

  // Dynamic Grid: If panel open, use fewer columns.
  const gridClass = selectedSector 
    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' 
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative items-start min-h-screen">
      
      {/* LEFT SIDE: Main Content (Flows naturally with page scroll) */}
      <div className="flex-1 w-full">
        
        {/* Search Bar */}
        <div className="mb-6">
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

        {/* Content Area */}
        <div className="pb-20">
            {/* Main Indices */}
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

            {/* Sectoral Indices */}
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

            {/* Empty State */}
            {highlights.length === 0 && secondary.length === 0 && (
                <div className="py-10 text-center text-slate-500">
                    No indices found matching "{searchQuery}".
                </div>
            )}
        </div>
      </div>

      {/* RIGHT SIDE: DETAILS PANEL */}
      {/* Mobile: Full Screen Overlay. Desktop: Sticky Sidebar */}
      {selectedSector && (
        <>
            {/* Mobile Overlay (Z-Index High) */}
            <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col lg:hidden">
                <div className="flex items-center p-4 border-b border-slate-100 dark:border-slate-800">
                    <button onClick={handleClose} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="font-medium">Back to Market</span>
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <MarketConstituents 
                        indexName={selectedName} 
                        tickers={selectedTickers} 
                        onClose={handleClose}
                        filterText={searchQuery} 
                    />
                </div>
            </div>

            {/* Desktop Sticky Panel */}
            <div className="hidden lg:block w-96 flex-shrink-0 sticky top-4 h-[calc(100vh-40px)] border-l border-slate-200 dark:border-slate-800 pl-6">
                <MarketConstituents 
                    indexName={selectedName} 
                    tickers={selectedTickers} 
                    onClose={handleClose}
                    filterText={searchQuery} 
                />
            </div>
        </>
      )}

    </div>
  )
}