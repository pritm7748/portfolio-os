'use client'

import { useState, useMemo } from 'react'
import { Download, Filter, Calendar, FileText, Loader2 } from 'lucide-react'
import { useTransactions } from '@/hooks/use-portfolio-data'

export default function ReportsPage() {
  const { data: transactions, isLoading } = useTransactions()
  
  // State for Filters
  const [selectedYear, setSelectedYear] = useState('2024-2025')
  const [reportType, setReportType] = useState('All') // 'All', 'Equity', 'Commodity'

  // --- ENGINE: Process Reports from Cached Data ---
  const { reportData, yearsAvailable, totalProfit } = useMemo(() => {
      if (!transactions) return { reportData: [], yearsAvailable: [], totalProfit: 0 }

      // 1. Filter for Realized Transactions Only (Sold items)
      // We also include Dividends as they are taxable income
      const realizedTxns = transactions.filter(t => 
          (t.transaction_type === 'Sell' && t.realised_pnl !== null) || 
          (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest')
      )

      // 2. Extract Financial Years
      const yearsSet = new Set<string>()
      
      const processed = realizedTxns.map(t => {
          const date = new Date(t.date)
          const month = date.getMonth() // 0-11
          const year = date.getFullYear()
          
          // Indian FY: If Month is Jan(0), Feb(1), Mar(2) -> It belongs to Previous Year-Current Year
          // Example: March 2025 is FY 2024-2025. April 2025 is FY 2025-2026.
          const fyStart = month >= 3 ? year : year - 1
          const fyLabel = `${fyStart}-${fyStart + 1}`
          yearsSet.add(fyLabel)

          return { ...t, fy: fyLabel }
      })

      // 3. Filter by Selection
      const filtered = processed.filter(t => {
          if (t.fy !== selectedYear) return false
          
          if (reportType === 'Equity') return t.assets.asset_type === 'Stock' || t.assets.asset_type === 'Mutual Fund'
          if (reportType === 'Commodity') return t.assets.asset_type.includes('Commodity') || t.assets.asset_type.includes('Gold')
          
          return true
      })

      // 4. Calculate Totals
      const total = filtered.reduce((sum, t) => {
          if (t.transaction_type === 'Dividend' || t.transaction_type === 'Interest') {
              return sum + Number(t.total_value)
          }
          return sum + Number(t.realised_pnl || 0)
      }, 0)

      // Sort recent first
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      const sortedYears = Array.from(yearsSet).sort().reverse()
      // Default to latest year if current selection is invalid
      if (sortedYears.length > 0 && !yearsSet.has(selectedYear)) {
          // Ideally we set state here, but in render we just fallback visually
      }

      return { reportData: filtered, yearsAvailable: sortedYears, totalProfit: total }

  }, [transactions, selectedYear, reportType])

  const handleDownload = () => {
      const csv = "Date,Asset,Type,Action,Qty,Price,Realized P&L\n" +
          reportData.map(t => {
              const pnl = t.transaction_type === 'Sell' ? t.realised_pnl : t.total_value
              return `${t.date},${t.assets.name},${t.assets.asset_type},${t.transaction_type},${t.quantity},${t.price},${pnl}`
          }).join("\n")
      
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Tax_Report_${selectedYear}.csv`
      a.click()
  }

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>

  return (
    <div className="space-y-6">
      
      <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h2>
          <button 
            onClick={handleDownload}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
                className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
              >
                  <option value="All">All Realized P&L</option>
                  <option value="Equity">Capital Gains (Equity)</option>
                  <option value="Commodity">Capital Gains (Commodity)</option>
              </select>
          </div>

          <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
              >
                  {yearsAvailable.length > 0 ? (
                      yearsAvailable.map(y => <option key={y} value={y}>FY {y}</option>)
                  ) : (
                      <option>No Data</option>
                  )}
              </select>
          </div>
      </div>

      {/* SUMMARY CARD */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
              <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">FY {selectedYear}</h3>
                  <p className="text-sm text-slate-500">Realized Profit & Loss Statement</p>
              </div>
              <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Total Profit</div>
                  <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalProfit >= 0 ? '+' : ''}₹{totalProfit.toLocaleString('en-IN')}
                  </div>
              </div>
          </div>

          {/* TABLE */}
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
              {reportData.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No realized transactions found for this period.</div>
              ) : (
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Asset</th>
                              <th className="px-4 py-3 text-right">Qty</th>
                              <th className="px-4 py-3 text-right">Price</th>
                              <th className="px-4 py-3 text-right">Realized P&L</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {reportData.map((t) => {
                              // Determine PnL display
                              const isSell = t.transaction_type === 'Sell'
                              const pnl = isSell ? Number(t.realised_pnl) : Number(t.total_value)
                              
                              return (
                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 text-slate-500">{t.date}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                        {t.assets.name} 
                                        <span className="ml-2 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">{t.assets.ticker}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">{t.transaction_type === 'Sell' ? t.quantity : '-'}</td>
                                    <td className="px-4 py-3 text-right text-slate-500">₹{t.price}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                              )
                          })}
                      </tbody>
                  </table>
              )}
          </div>
      </div>
    </div>
  )
}