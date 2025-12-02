'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Download, Loader2, RefreshCw, ChevronRight, Trash2, Scissors, X, Info, TrendingUp, TrendingDown } from 'lucide-react'
import TransactionModal from '@/components/transaction-modal'
import AssetDetailsDrawer from '@/components/asset-details-drawer'
import CorporateActionModal from '@/components/corporate-action-modal'
import { usePortfolio } from '@/context/portfolio-context'
import { useTransactions, useLivePrices } from '@/hooks/use-portfolio-data'

type Holding = {
  ticker: string
  rootSymbol: string
  name: string
  type: string
  quantity: number
  avgPrice: number
  totalInvested: number
  currentPrice: number 
  currentValue: number 
  dayChangePercent: number 
  dayChangeValue: number   
  pnl: number
  pnlPercent: number
  assetIds: number[]
  hasNSE?: boolean
  hasBSE?: boolean
}

export default function HoldingsPage() {
  const { selectedPortfolio } = usePortfolio()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<{ids: number[], name: string, ticker: string} | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  // UI State
  const [filterType, setFilterType] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. DATA HOOKS (Cached & Fast)
  const { data: transactions, isLoading: txnsLoading, refetch: refetchTxns } = useTransactions()

  // 2. Derive Tickers for Price Fetching
  const allTickers = useMemo(() => {
      if (!transactions) return []
      const set = new Set<string>()
      transactions.forEach(t => set.add(t.assets.ticker))
      return Array.from(set)
  }, [transactions])

  // 3. Fetch Prices (Auto-Refresh)
  const { data: priceMap, isLoading: pricesLoading } = useLivePrices(allTickers)

  const loading = txnsLoading || pricesLoading

  // 4. CALCULATION ENGINE (Memoized)
  const holdings = useMemo(() => {
      if (!transactions) return []

      const map: Record<string, Holding> = {}

      // FIFO Logic to calculate Holdings
      const assetLots: Record<string, { price: number, quantity: number }[]> = {}

      transactions.forEach(txn => {
          const t = txn.assets
          const ticker = t.ticker
          
          if (!assetLots[ticker]) assetLots[ticker] = []
          
          if (txn.transaction_type === 'Buy') {
              assetLots[ticker].push({ price: Number(txn.price), quantity: Number(txn.quantity) })
          } else if (txn.transaction_type === 'Sell') {
              let qtyToSell = Number(txn.quantity)
              while (qtyToSell > 0 && assetLots[ticker].length > 0) {
                  if (assetLots[ticker][0].quantity > qtyToSell) {
                      assetLots[ticker][0].quantity -= qtyToSell; qtyToSell = 0
                  } else {
                      qtyToSell -= assetLots[ticker][0].quantity; assetLots[ticker].shift()
                  }
              }
          }

          if (!map[ticker]) {
              map[ticker] = {
                  ticker, rootSymbol: ticker.split('.')[0], name: t.name, type: t.asset_type,
                  quantity: 0, avgPrice: 0, totalInvested: 0,
                  currentPrice: 0, currentValue: 0, dayChangePercent: 0, dayChangeValue: 0,
                  pnl: 0, pnlPercent: 0, assetIds: []
              }
          }
          // Collect IDs for the Drawer
          if (!map[ticker].assetIds.includes(txn.assets.id as any)) { // Type cast if needed based on your DB types
             // map[ticker].assetIds.push(txn.assets.id) 
             // Note: In your Supabase join, 'assets' is an object. We might need the asset_id from the txn row
             // Let's use the asset_id from the transaction row itself
             if (!map[ticker].assetIds.includes(txn.asset_id as any)) map[ticker].assetIds.push(txn.asset_id as any) 
          }
          // Assuming transactions have asset_id. If not, use txn.asset_id
      })

      // Final Aggregation
      return Object.values(map).map(h => {
          // Sum remaining lots
          let q = 0, c = 0
          if (assetLots[h.ticker]) {
              assetLots[h.ticker].forEach(lot => { q += lot.quantity; c += (lot.quantity * lot.price) })
          }
          
          if (q <= 0.000001) return null // Filter sold out positions

          h.quantity = q
          h.totalInvested = c
          h.avgPrice = c / q

          // Price Application
          const cleanTicker = h.ticker.toUpperCase().replace(/\s/g, '')
          let priceData = priceMap?.[h.ticker]
          
          if (!priceData && priceMap) {
              const foundKey = Object.keys(priceMap).find(k => k.includes(cleanTicker.split('.')[0]))
              if (foundKey) priceData = priceMap[foundKey]
          }

          h.currentPrice = priceData?.price || h.avgPrice
          h.dayChangePercent = priceData?.change || 0
          
          h.currentValue = h.quantity * h.currentPrice
          h.pnl = h.currentValue - h.totalInvested
          h.pnlPercent = (h.pnl / h.totalInvested) * 100

          // Day Change Value Calc
          const prevPrice = h.currentPrice / (1 + (h.dayChangePercent / 100))
          h.dayChangeValue = (h.currentPrice - prevPrice) * h.quantity

          return h
      }).filter(Boolean) as Holding[]

  }, [transactions, priceMap])

  // Filtering Logic
  const filteredHoldings = holdings.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            h.ticker.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (filterType === 'All') return matchesSearch
      if (filterType === 'Stock') return matchesSearch && h.type === 'Stock'
      if (filterType === 'Mutual Fund') return matchesSearch && h.type === 'Mutual Fund'
      if (filterType === 'Commodity') return matchesSearch && (h.type === 'Commodity' || h.type === 'Gold' || h.type === 'Silver')
      if (filterType === 'Currency') return matchesSearch && h.type === 'Currency'
      return matchesSearch
  })

  // Handlers
  const handleAssetClick = (h: Holding) => {
      // Find asset_ids from transactions for this ticker
      // We essentially just need to pass the ticker and name to the drawer
      // The drawer fetches transactions by asset_id, so we need valid IDs.
      // Our logic above collected them.
      setSelectedAsset({ ids: h.assetIds, name: h.name, ticker: h.ticker })
      setIsDrawerOpen(true)
  }

  const handleExport = () => {
      const csvContent = "data:text/csv;charset=utf-8," 
          + "Ticker,Name,Type,Quantity,Avg Price,Current Price,Invested,Current Value,P&L\n"
          + holdings.map(h => 
              `${h.ticker},"${h.name}",${h.type},${h.quantity},${h.avgPrice.toFixed(2)},${h.currentPrice},${h.totalInvested.toFixed(2)},${h.currentValue.toFixed(2)},${h.pnl.toFixed(2)}`
          ).join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", "holdings.csv")
      document.body.appendChild(link)
      link.click()
  }

  if (loading && holdings.length === 0) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-6 pb-20">
      
      {/* HEADER ACTIONS */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
            <button onClick={() => setIsSplitModalOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                <Scissors className="h-4 w-4" /> <span className="hidden sm:inline">Corp Actions</span>
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm">
                <Plus className="h-4 w-4" /> Add Transaction
            </button>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
                type="text" placeholder="Search holdings..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-white"
            />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['All', 'Stock', 'Mutual Fund', 'Commodity', 'Currency'].map(type => (
                <button 
                    key={type} 
                    onClick={() => setFilterType(type)}
                    className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${filterType === type ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                >
                    {type}
                </button>
            ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
            {filteredHoldings.length === 0 ? (
                <div className="flex h-60 flex-col items-center justify-center text-slate-400">
                    <p>No holdings found matching your criteria.</p>
                </div>
            ) : (
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                        <th className="px-6 py-4">Asset Name</th>
                        <th className="hidden sm:table-cell px-4 py-4">Type</th>
                        <th className="px-4 py-4 text-right">Qty</th>
                        <th className="hidden md:table-cell px-4 py-4 text-right">Avg. Price</th>
                        <th className="px-4 py-4 text-right">Live Price</th>
                        <th className="hidden md:table-cell px-4 py-4 text-right">Day Change</th>
                        <th className="hidden lg:table-cell px-4 py-4 text-right">Total Value</th>
                        <th className="px-4 py-4 text-right">Total P&L</th>
                        <th className="px-4 py-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHoldings.map((holding) => (
                    <tr 
                        key={holding.ticker} 
                        onClick={() => handleAssetClick(holding)}
                        className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                        <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 dark:text-white">{holding.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{holding.ticker}</div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-4">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {holding.type}
                            </span>
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {holding.quantity}
                        </td>
                        <td className="hidden md:table-cell px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                            ₹{holding.avgPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            ₹{holding.currentPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="hidden md:table-cell px-4 py-4 text-right">
                            <div className={`flex flex-col items-end ${holding.dayChangeValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span className="font-medium">{holding.dayChangeValue >= 0 ? '+' : ''}₹{Math.abs(holding.dayChangeValue).toFixed(0)}</span>
                                <span className="text-xs opacity-80">{Math.abs(holding.dayChangePercent).toFixed(2)}%</span>
                            </div>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                            ₹{holding.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-4 text-right">
                            <div className={`flex flex-col items-end ${holding.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span className="font-bold">{holding.pnl >= 0 ? '+' : ''}₹{Math.abs(holding.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                <span className="text-xs opacity-80">{holding.pnlPercent.toFixed(2)}%</span>
                            </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
                        </td>
                    </tr>
                    ))}
                </tbody>
            </table>
            )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <Info className="h-4 w-4" />
        <span>Note: Commodity prices are approximations based on global spot rates + estimated duties.</span>
      </div>

      {/* Modals - Refetch on success triggers React Query invalidation in future, for now it triggers the hook to re-run via key update if needed, but actually we need to tell React Query to invalidate. 
          The 'onSuccess' in the modals currently calls a manual 'fetchHoldings'. 
          Since we are using hooks, we should pass 'refetchTxns' to onSuccess. 
      */}
      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetchTxns()} 
      />

      <CorporateActionModal 
        isOpen={isSplitModalOpen} 
        onClose={() => setIsSplitModalOpen(false)} 
        onSuccess={() => refetchTxns()} 
      />

      <AssetDetailsDrawer 
        asset={selectedAsset}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdate={() => refetchTxns()}
      />
    </div>
  )
}