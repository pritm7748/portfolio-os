// app/dashboard/market/page.tsx
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
    // On Desktop: Toggle off if clicking same. On Mobile: Always open.
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

  return (
    // Container locked to viewport height minus header (approx 80px)
    <div className="flex h-[calc(100vh-100px)] gap-6 overflow-hidden">
      
      {/* LEFT SIDE: MAIN SCROLLABLE LIST */}
      <div className={`
          flex-1 flex flex-col overflow-hidden transition-all duration-300
          ${selectedSector ? 'lg:mr-0' : ''} 
      `}>
        
        {/* Header & Search */}
        <div className="mb-4 flex-shrink-0 pr-2">
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

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 pb-10 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            
            {/* Main Indices */}
            {highlights.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Market Overview</h2>
                    {/* Responsive Grid: 1 col mobile, up to 4 cols desktop */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      {/* Mobile: Fixed Full Screen Overlay. Desktop: Static Side Panel */}
      {selectedSector && (
        <div className="
            fixed inset-0 z-50 flex flex-col bg-white shadow-2xl
            lg:static lg:z-auto lg:w-96 lg:bg-transparent lg:shadow-none lg:border-l lg:border-slate-200 lg:dark:border-slate-800 lg:pl-0
            dark:bg-slate-950
        ">
            <div className="flex-1 overflow-hidden h-full">
                <MarketConstituents 
                    indexName={selectedName} 
                    tickers={selectedTickers} 
                    onClose={handleClose}
                />
            </div>
        </div>
      )}

    </div>
  )
}