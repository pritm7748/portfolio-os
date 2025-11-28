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
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      
      {/* LEFT SIDE: THE LIST (Visible on Desktop, Hidden on Mobile if Detail is Open) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Search Bar Container */}
        <div className="p-1 pb-4 flex-shrink-0">
             <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search indices (e.g. Bank, Auto)..."
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

        {/* Scrollable Grid Area */}
        <div className="flex-1 overflow-y-auto pb-20 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {/* Main Indices */}
            {highlights.length > 0 && (
                <div className="mb-6">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    <h3 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Sectors & Themes</h3>
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      {/* Desktop: Sticky Side Panel. Mobile: Full Screen Overlay */}
      {selectedSector && (
        <div className="
            fixed inset-0 z-50 bg-white flex flex-col
            lg:static lg:z-auto lg:w-96 lg:bg-transparent lg:border-l lg:border-slate-200 lg:dark:border-slate-800 lg:ml-6
            dark:bg-slate-950
        ">
            {/* Mobile Header (Back Button) */}
            <div className="flex items-center p-4 border-b border-slate-100 dark:border-slate-800 lg:hidden">
                <button onClick={handleClose} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="font-medium">Back to Market</span>
                </button>
            </div>

            {/* The Content */}
            <div className="flex-1 overflow-hidden h-full lg:pt-0">
                <MarketConstituents 
                    indexName={selectedName} 
                    tickers={selectedTickers} 
                    onClose={handleClose}
                    filterText={searchQuery} 
                />
            </div>
        </div>
      )}

    </div>
  )
}