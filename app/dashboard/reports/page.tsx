'use client'

import { useState, useMemo } from 'react'
import { Download, Filter, Calendar, Loader2 } from 'lucide-react'
import { useTransactions } from '@/hooks/use-portfolio-data'

export default function ReportsPage() {
  // 1. PERFORMANCE: Use Cached Transactions (Instant Load)
  const { data: transactions, isLoading } = useTransactions()
  
  // State for Filters
  const [selectedYear, setSelectedYear] = useState('FY 2025-2026') // Default to current FY
  const [reportType, setReportType] = useState('All Realized P&L')

  // --- ENGINE: Process Reports from Cached Data ---
  const { reportData, yearsAvailable, totalProfit } = useMemo(() => {
      if (!transactions) return { reportData: [], yearsAvailable: [], totalProfit: 0 }

      // 1. Identify Financial Years & Filter Relevant Txns
      const yearsSet = new Set<string>()
      const relevantTxns: any[] = []

      transactions.forEach(t => {
          // Only include Sells with PnL OR Income entries
          if ((t.transaction_type === 'Sell' && t.realised_pnl !== null) || 
              t.transaction_type === 'Dividend' || 
              t.transaction_type === 'Interest') {
              
              const date = new Date(t.date)
              const month = date.getMonth() // 0 = Jan
              const year = date.getFullYear()
              
              // Indian FY Calculation: If Jan/Feb/Mar, it belongs to previous year start
              // e.g., March 2025 is FY 2024-2025
              const startYear = month >= 3 ? year : year - 1
              const fyLabel = `FY ${startYear}-${startYear + 1}`
              
              yearsSet.add(fyLabel)
              
              // Attach FY to transaction for easier filtering
              relevantTxns.push({ ...t, fy: fyLabel })
          }
      })

      // 2. Apply Filters
      const filtered = relevantTxns.filter(t => {
          // Date Filter
          if (selectedYear !== 'All Years' && t.fy !== selectedYear) return false
          
          // Type Filter
          if (reportType === 'All Realized P&L') return true
          if (reportType === 'Dividends & Income') return t.transaction_type === 'Dividend' || t.transaction_type === 'Interest'
          
          const isEquity = t.assets.asset_type === 'Stock' || t.assets.asset_type === 'Mutual Fund'
          if (reportType === 'Capital Gains (Equity)') return isEquity && t.transaction_type === 'Sell'
          if (reportType === 'Capital Gains (Commodity/Other)') return !isEquity && t.transaction_type === 'Sell'
          
          return true
      })

      // 3. Sort by Date (Recent First)
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // 4. Calculate Total P&L for the view
      const total = filtered.reduce((sum, t) => {
          // For Sells, use realised_pnl. For Divs, use total_value (income).
          const val = t.transaction_type === 'Sell' ? Number(t.realised_pnl) : Number(t.total_value)
          return sum + val
      }, 0)

      const sortedYears = Array.from(yearsSet).sort().reverse()

      return { reportData: filtered, yearsAvailable: sortedYears, totalProfit: total }

  }, [transactions, selectedYear, reportType])

  // CSV Export Logic
  const handleDownload = () => {
      const csvHeader = "Date,Asset,Type,Action,Qty,Buy Price,Sell Price,Realized P&L\n"
      const csvRows = reportData.map(t => {
          const isSell = t.transaction_type === 'Sell'
          const pnl = isSell ? Number(t.realised_pnl) : Number(t.total_value)
          const sellPrice = isSell ? t.price : 0
          
          // Reverse Engineer Buy Price: (Total Sell Value - PnL) / Qty
          // Total Sell Value = price * qty
          // Cost = Total Sell Value - PnL
          // Buy Price = Cost / Qty
          let buyPrice = 0
          if (isSell && t.quantity > 0) {
              const totalSellValue = t.price * t.quantity
              const costBasis = totalSellValue - pnl
              buyPrice = costBasis / t.quantity
          }

          return `${t.date},${t.assets.name},${t.assets.asset_type},${t.transaction_type},${t.quantity},${buyPrice.toFixed(2)},${sellPrice},${pnl}`
      }).join("\n")
      
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Report_${selectedYear}.csv`
      a.click()
  }

  if (isLoading && reportData.length === 0) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h2>
          <button 
            onClick={handleDownload}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
              <Download className="h-4 w-4" /> Download Report
          </button>
      </div>

      {/* FILTERS */}
      <div className="flex gap-4">
          <div className="relative">
              <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <select 
                value={reportType} 
                onChange={(e) => setReportType(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 min-w-[180px]"
              >
                  <option>All Realized P&L</option>
                  <option>Dividends & Income</option>
                  <option>Capital Gains (Equity)</option>
                  <option>Capital Gains (Commodity/Other)</option>
              </select>
          </div>

          <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 min-w-[150px]"
              >
                  {yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
                  <option value="All Years">All Years</option>
              </select>
          </div>
      </div>

      {/* SUMMARY CARD */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
              <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{selectedYear}</h3>
                  <p className="text-sm text-slate-500">
                      {reportType === 'All Realized P&L' ? 'Total Realized Profit & Loss' : reportType}
                  </p>
              </div>
              <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Total Profit</div>
                  <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalProfit >= 0 ? '+' : ''}₹{totalProfit.toLocaleString('en-IN')}
                  </div>
              </div>
          </div>

          {/* DATA TABLE */}
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
              {reportData.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50">
                      No realized transactions found for this period.
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                              <tr>
                                  <th className="px-6 py-4 font-medium">Date</th>
                                  <th className="px-6 py-4 font-medium">Asset</th>
                                  <th className="px-6 py-4 font-medium text-right">Qty</th>
                                  <th className="px-6 py-4 font-medium text-right">Buy Price</th>
                                  <th className="px-6 py-4 font-medium text-right">Sell Price</th>
                                  <th className="px-6 py-4 font-medium text-right">Realized P&L</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {reportData.map((t) => {
                                  const isSell = t.transaction_type === 'Sell'
                                  const pnl = isSell ? Number(t.realised_pnl) : Number(t.total_value)
                                  
                                  // Reverse Engineer Buy Price for display
                                  let buyPrice = 0
                                  if (isSell && t.quantity > 0) {
                                      const totalSellValue = Number(t.price) * Number(t.quantity)
                                      const costBasis = totalSellValue - pnl
                                      buyPrice = costBasis / Number(t.quantity)
                                  }

                                  return (
                                    <tr key={t.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{t.date}</td>
                                        
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-white">{t.assets.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.assets.ticker}</div>
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                                            {isSell ? t.quantity : '-'}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                                            {isSell ? `₹${buyPrice.toLocaleString('en-IN', {maximumFractionDigits: 0})}` : '-'}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                                            {isSell ? `₹${Number(t.price).toLocaleString('en-IN')}` : '-'}
                                        </td>
                                        
                                        <td className={`px-6 py-4 text-right font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      </div>
    </div>
  )
}