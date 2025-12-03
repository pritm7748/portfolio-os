'use client'

import { useState, useEffect } from 'react'
import { Loader2, Download, Filter, Calendar } from 'lucide-react'
import { useTransactions } from '@/hooks/use-portfolio-data'

type ReportItem = { 
    id: string 
    ticker: string
    name: string
    date: string
    type: string
    amount: number
    quantity?: number
    price?: number // This is the Sell Price for P&L rows
}

type FinancialYearGroup = { 
    year: string
    totalAmount: number
    items: ReportItem[] 
}

export default function ReportsPage() {
  // 1. OPTIMIZATION: Replace manual fetch with Hook
  const { data: transactions, isLoading: txnsLoading } = useTransactions()
  
  const [reportData, setReportData] = useState<FinancialYearGroup[]>([])
  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('All')
  const [loading, setLoading] = useState(true) // Local loading state for calculations
  const [reportType, setReportType] = useState('pnl') 

  useEffect(() => {
    const processReports = async () => {
      // Wait for hook to load
      if (txnsLoading || !transactions) return
      
      setLoading(true)

      const processedItems: ReportItem[] = []
      const uniqueTickers = new Set<string>()

      if (reportType === 'dividend') {
          // --- DIVIDEND LOGIC (Preserved) ---
          transactions.forEach((txn: any) => {
              uniqueTickers.add(txn.assets.ticker)
              if (txn.transaction_type === 'Dividend' || txn.transaction_type === 'Interest') {
                  processedItems.push({
                      id: `txn-${txn.id}`,
                      ticker: txn.assets.ticker,
                      name: txn.assets.name,
                      date: txn.date,
                      type: txn.transaction_type,
                      amount: Number(txn.total_value)
                  })
              }
          })

          // Auto-Detect Logic
          const tickersArray = Array.from(uniqueTickers)
          if (tickersArray.length > 0) {
             try {
                const divRes = await fetch('/api/dividends', { method: 'POST', body: JSON.stringify({ tickers: tickersArray }) })
                const dividendMap = await divRes.json()

                tickersArray.forEach(ticker => {
                    const dividends = dividendMap[ticker]
                    if (!dividends) return
                    const stockTxns = transactions.filter((t: any) => t.assets.ticker === ticker)
                    dividends.forEach((div: any) => {
                        const divDate = new Date(div.date)
                        let qtyOnDate = 0
                        stockTxns.forEach((t: any) => {
                            const txnDate = new Date(t.date)
                            if (txnDate < divDate) {
                                if (t.transaction_type === 'Buy') qtyOnDate += Number(t.quantity)
                                else if (t.transaction_type === 'Sell') qtyOnDate -= Number(t.quantity)
                            }
                        })
                        if (qtyOnDate > 0) {
                            // Check duplicates (simple check based on date/ticker)
                            // In a real app we might want deeper deduping, but keeping original logic
                            processedItems.push({
                                id: `auto-${ticker}-${div.date}`,
                                ticker: ticker,
                                name: stockTxns[0].assets.name,
                                date: div.date,
                                type: 'Dividend (Auto)',
                                amount: qtyOnDate * div.amount
                            })
                        }
                    })
                })
             } catch (e) { console.error(e) }
          }

      } else {
          // --- P&L LOGIC (Preserved) ---
          transactions.forEach((txn: any) => {
              if (txn.transaction_type === 'Sell') {
                  const assetType = txn.assets.asset_type
                  let include = false
                  if (reportType === 'pnl') include = true
                  else if (reportType === 'equity' && (assetType === 'Stock' || assetType === 'Mutual Fund')) include = true
                  else if (reportType === 'other' && (assetType === 'Commodity' || assetType === 'Currency' || assetType === 'Debt')) include = true

                  if (include) {
                      processedItems.push({
                          id: `txn-${txn.id}`,
                          ticker: txn.assets.ticker,
                          name: txn.assets.name,
                          date: txn.date,
                          type: 'Realized P&L',
                          quantity: Number(txn.quantity),
                          price: Number(txn.price), // Sell Price
                          amount: Number(txn.realised_pnl)
                      })
                  }
              }
          })
      }

      const groups: Record<string, FinancialYearGroup> = {}
      const yearSet = new Set<string>()

      processedItems.forEach(item => {
        const date = new Date(item.date)
        const month = date.getMonth()
        const year = date.getFullYear()
        const fyStart = month >= 3 ? year : year - 1
        const fyLabel = `FY ${fyStart}-${fyStart + 1}`
        
        yearSet.add(fyLabel)

        if (!groups[fyLabel]) {
            groups[fyLabel] = { year: fyLabel, totalAmount: 0, items: [] }
        }
        groups[fyLabel].totalAmount += item.amount
        groups[fyLabel].items.push(item)
        groups[fyLabel].items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      })

      const sortedYears = Array.from(yearSet).sort().reverse()
      setYears(sortedYears)
      
      let finalData = Object.values(groups).sort((a, b) => b.year.localeCompare(a.year))
      if (selectedYear !== 'All') {
          finalData = finalData.filter(g => g.year === selectedYear)
      }

      setReportData(finalData)
      setLoading(false)
    }

    processReports()
  }, [transactions, txnsLoading, reportType, selectedYear]) // Re-run when cached transactions load or filters change

  // Preserved CSV Export
  const downloadCSV = () => {
    const headers = ['Date,Financial Year,Ticker,Name,Type,Quantity,Buy Price,Sell Price,Realized P&L']
    const rows = reportData.flatMap(group => 
        group.items.map(item => {
            let buyPrice = 0
            if (reportType !== 'dividend' && item.quantity && item.price) {
                buyPrice = item.price - (item.amount / item.quantity)
            }
            const buyPriceStr = buyPrice > 0 ? buyPrice.toFixed(2) : ''
            const sellPriceStr = item.price ? item.price.toFixed(2) : ''
            
            return `${item.date.split('T')[0]},${group.year},${item.ticker},"${item.name}",${item.type},${item.quantity || ''},${buyPriceStr},${sellPriceStr},${item.amount}`
        })
    )
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `portfolio_report_${reportType}.csv`)
    document.body.appendChild(link)
    link.click()
  }

  // Use combined loading state
  if (loading && (!transactions || reportData.length === 0)) {
      return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-48">
                <select 
                    value={reportType}
                    onChange={(e) => { setReportType(e.target.value); setSelectedYear('All'); }}
                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 hover:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300"
                >
                    <option value="pnl">All Realized P&L</option>
                    <option value="dividend">Dividends & Income</option>
                    <option value="equity">Capital Gains (Equity)</option>
                    <option value="other">Capital Gains (Commodity/Other)</option>
                </select>
                <Filter className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>

            <div className="relative w-full sm:w-40">
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white pl-4 pr-10 py-2.5 text-sm font-medium text-slate-700 hover:border-indigo-500 focus:outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300"
                >
                    <option value="All">All Years</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <Calendar className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>
         </div>

         <button 
            onClick={downloadCSV}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 w-full md:w-auto justify-center"
        >
            <Download className="h-4 w-4" />
            Download Report
        </button>
      </div>

      {reportData.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:bg-slate-900 dark:border-slate-800">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Filter className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">No records found</h3>
            <p className="text-slate-500 dark:text-slate-400">No data matches your selected filters.</p>
        </div>
      ) : (
        reportData.map((group) => (
            <div key={group.year} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4 dark:bg-slate-800 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white">{group.year}</h3>
                    <div className="text-right">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block">Total {reportType === 'dividend' ? 'Income' : 'Profit'}</span>
                        <span className={`text-lg font-bold ${group.totalAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {group.totalAmount >= 0 ? '+' : ''}₹{group.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-3 font-medium whitespace-nowrap">Date</th>
                                <th className="px-6 py-3 font-medium">Asset</th>
                                
                                {reportType !== 'dividend' && <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Qty</th>}
                                {reportType !== 'dividend' && <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Buy Price</th>}
                                {reportType !== 'dividend' && <th className="px-6 py-3 font-medium text-right whitespace-nowrap">Sell Price</th>}
                                
                                <th className="px-6 py-3 font-medium text-right whitespace-nowrap">
                                    {reportType === 'dividend' ? 'Amount' : 'Realized P&L'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.items.map((item) => {
                                let buyPrice = 0
                                if (reportType !== 'dividend' && item.quantity && item.price) {
                                    buyPrice = item.price - (item.amount / item.quantity)
                                }

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{item.date.split('T')[0]}</td>
                                        <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                                            {item.name} <span className="text-slate-400 text-xs ml-1">({item.ticker})</span>
                                        </td>
                                        
                                        {reportType !== 'dividend' && (
                                            <>
                                                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                                                    ₹{buyPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                                                    ₹{item.price?.toLocaleString('en-IN')}
                                                </td>
                                            </>
                                        )}

                                        <td className={`px-6 py-3 text-right font-bold whitespace-nowrap ${
                                            reportType === 'dividend' 
                                                ? 'text-emerald-600 dark:text-emerald-400' 
                                                : item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                        }`}>
                                            {item.amount >= 0 ? '+' : ''}₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        ))
      )}
    </div>
  )
}