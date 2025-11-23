'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Download, Loader2, RefreshCw, ChevronRight, Trash2, Scissors, X } from 'lucide-react'
import TransactionModal from '@/components/transaction-modal'
import AssetDetailsDrawer from '@/components/asset-details-drawer'
import CorporateActionModal from '@/components/corporate-action-modal'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

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
  
  // CHANGED: selectedAsset now stores an ARRAY of IDs
  const [selectedAsset, setSelectedAsset] = useState<{ids: number[], name: string, ticker: string} | null>(null)
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  
  const supabase = createClient()

  const fetchHoldings = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('transactions')
        .select(`*, assets ( id, ticker, name, asset_type )`)
        .order('date', { ascending: true })

      if (selectedPortfolio.id !== 'all') {
          query = query.eq('portfolio_id', selectedPortfolio.id)
      }

      const { data: transactions, error } = await query
      if (error) throw error

      const portfolio: Record<string, Holding> = {}
      const assetLots: Record<string, { price: number, quantity: number }[]> = {}

      transactions?.forEach((txn: any) => {
        const rawTicker = txn.assets.ticker.toUpperCase()
        const rootSymbol = rawTicker.split('.')[0]
        const isStandardStock = rawTicker.endsWith('.NS') || rawTicker.endsWith('.BO')
        const key = isStandardStock ? rootSymbol : rawTicker

        if (!portfolio[key]) {
          portfolio[key] = {
            ticker: rawTicker,
            rootSymbol: key,
            name: txn.assets.name,
            type: txn.assets.asset_type,
            quantity: 0,
            totalInvested: 0,
            avgPrice: 0,
            currentPrice: 0,
            currentValue: 0,
            pnl: 0,
            pnlPercent: 0,
            assetIds: [],
            hasNSE: false,
            hasBSE: false
          }
          assetLots[key] = []
        }

        if (rawTicker.endsWith('.NS')) portfolio[key].hasNSE = true
        if (rawTicker.endsWith('.BO')) portfolio[key].hasBSE = true
        
        if (!portfolio[key].assetIds.includes(txn.assets.id)) {
            portfolio[key].assetIds.push(txn.assets.id)
        }

        if (txn.transaction_type === 'Buy') {
            assetLots[key].push({ price: Number(txn.price), quantity: Number(txn.quantity) })
        } else if (txn.transaction_type === 'Sell') {
            let qtyToSell = Number(txn.quantity)
            while (qtyToSell > 0 && assetLots[key].length > 0) {
                const oldestLot = assetLots[key][0]
                if (oldestLot.quantity > qtyToSell) {
                    oldestLot.quantity -= qtyToSell
                    qtyToSell = 0
                } else {
                    qtyToSell -= oldestLot.quantity
                    assetLots[key].shift()
                }
            }
        }
      })

      Object.values(portfolio).forEach(p => {
          if (p.hasNSE) p.ticker = `${p.rootSymbol}.NS`
          else if (p.hasBSE) p.ticker = `${p.rootSymbol}.BO`

          let totalQty = 0
          let totalCost = 0
          assetLots[p.rootSymbol].forEach(lot => {
              totalQty += lot.quantity
              totalCost += (lot.quantity * lot.price)
          })

          p.quantity = totalQty
          p.totalInvested = totalCost
          p.avgPrice = totalQty > 0 ? totalCost / totalQty : 0
      })

      const holdingList = Object.values(portfolio).filter(h => h.quantity > 0)
      const tickers = holdingList.map(h => h.ticker)

      if (tickers.length > 0) {
        try {
            const response = await fetch('/api/prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers })
            })
            const priceMap = await response.json()

            holdingList.forEach(h => {
                let price = priceMap[h.ticker]
                if (!price) {
                    const root = h.ticker.split('.')[0]
                    const foundKey = Object.keys(priceMap).find(k => k.includes(root))
                    if (foundKey) price = priceMap[foundKey]
                }
                if (price) h.currentPrice = price
                else h.currentPrice = h.avgPrice 
            })
        } catch (err) {
            console.error("Failed to fetch prices", err)
        }
      }

      const finalHoldings = holdingList.map(h => {
        h.currentValue = h.quantity * h.currentPrice
        h.pnl = h.currentValue - h.totalInvested
        h.pnlPercent = h.totalInvested > 0 ? (h.pnl / h.totalInvested) * 100 : 0
        return h
      })

      setHoldings(finalHoldings)

    } catch (error) {
      console.error('Error fetching holdings:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, selectedPortfolio])

  useEffect(() => { fetchHoldings() }, [fetchHoldings])

  const handleRowClick = (asset: Holding) => {
    // CHANGED: Pass ALL merged asset IDs to the drawer
    setSelectedAsset({ ids: asset.assetIds, name: asset.name, ticker: asset.ticker })
    setIsDrawerOpen(true)
  }

  const filteredHoldings = holdings.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          h.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTab = activeTab === 'All' || h.type === activeTab
    return matchesSearch && matchesTab
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search holdings..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
          />
          {searchTerm && (
            <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
                <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
            <button onClick={fetchHoldings} className="p-2 text-slate-500 hover:text-indigo-600 transition dark:text-slate-400 dark:hover:text-indigo-400" title="Refresh Prices">
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button 
                onClick={() => setIsSplitModalOpen(true)}
                className="p-2 text-slate-500 hover:text-indigo-600 transition dark:text-slate-400 dark:hover:text-indigo-400" 
                title="Stock Splits & Bonus"
            >
                <Scissors className="h-5 w-5" />
            </button>

          <button className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm">
            <Plus className="h-4 w-4" />
            Add Transaction
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['All', 'Stock', 'Mutual Fund', 'Gold', 'Currency'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeTab === tab
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm min-h-[300px] dark:bg-slate-900 dark:border-slate-800">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Updating prices...
          </div>
        ) : filteredHoldings.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-500 dark:text-slate-400">
            <p>No holdings found in this portfolio.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Asset Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium text-right">Qty</th>
                  <th className="px-6 py-4 font-medium text-right">
                    Avg. Price <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">FIFO</span>
                  </th>
                  <th className="px-6 py-4 font-medium text-right text-indigo-600 dark:text-indigo-400">Live Price</th>
                  <th className="px-6 py-4 font-medium text-right">Total Value</th>
                  <th className="px-6 py-4 font-medium text-right">P&L</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHoldings.map((holding) => (
                  <tr 
                    key={holding.rootSymbol} 
                    onClick={() => handleRowClick(holding)} 
                    className="hover:bg-slate-50 transition cursor-pointer group dark:hover:bg-slate-800/50"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {holding.name}
                      <span className="ml-2 text-xs text-slate-400">({holding.ticker})</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {holding.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-900 dark:text-slate-200">{holding.quantity}</td>
                    <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                      ₹{holding.avgPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-indigo-600 dark:text-indigo-400">
                       ₹{holding.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-white">
                      ₹{holding.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${holding.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {holding.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-4 text-right">
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchHoldings} 
      />

      <CorporateActionModal 
        isOpen={isSplitModalOpen} 
        onClose={() => setIsSplitModalOpen(false)} 
        onSuccess={fetchHoldings} 
      />

      <AssetDetailsDrawer 
        asset={selectedAsset}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdate={fetchHoldings}
      />

    </div>
  )
}