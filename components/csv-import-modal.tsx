'use client'

import { useState } from 'react'
import { X, UploadCloud, Loader2, FileText, CheckCircle, AlertTriangle, Calendar } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/context/portfolio-context'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ParsedRow = {
  ticker: string
  date: string
  type: 'Buy' | 'Sell'
  quantity: number
  price: number
  status: 'pending' | 'success' | 'error'
  msg?: string
}

export default function CsvImportModal({ isOpen, onClose, onSuccess }: Props) {
  const { portfolios } = usePortfolio()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [targetPortfolioId, setTargetPortfolioId] = useState<number>(0)
  
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().split('T')[0])
  
  const supabase = createClient()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const f = e.target.files[0]
        setFile(f)
        
        if (f.name.endsWith('.csv')) {
            parseCSV(f)
        } else if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
            parseExcel(f)
        } else {
            alert("Unsupported file format. Please use CSV or Excel.")
        }
    }
  }

  // --- SMART PARSING LOGIC ---
  
  const cleanNumber = (val: any) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
          // Remove commas and currency symbols
          return parseFloat(val.replace(/,/g, '').replace(/[^\d.-]/g, ''))
      }
      return 0
  }

  const processRows = (rows: any[]) => {
    const mappedData: ParsedRow[] = []
    
    rows.forEach((row: any) => {
        // Normalize Keys
        const keys = Object.keys(row).reduce((acc, k) => { 
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '')
            acc[cleanKey] = row[k]
            return acc 
        }, {} as any)

        // 1. Ticker (Groww: 'Instrument Name')
        const ticker = keys['symbol'] || keys['ticker'] || keys['stockname'] || keys['instrumentname'] || keys['instrument'] || row['Symbol']
        
        // 2. Date
        let finalDate = defaultDate
        const rawDate = keys['date'] || keys['tradedate'] || keys['orderdate']
        if (rawDate) {
            if (typeof rawDate === 'number') {
                 const dateObj = new Date((rawDate - (25567 + 2)) * 86400 * 1000)
                 finalDate = dateObj.toISOString().split('T')[0]
            } else {
                 const d = new Date(rawDate)
                 if (!isNaN(d.getTime())) finalDate = d.toISOString().split('T')[0]
            }
        }
        
        // 3. Type (Default to Buy for Holdings Reports)
        let type = keys['type'] || keys['action'] || keys['transaction'] || keys['tradetype']
        const normType = type?.toString().toLowerCase().includes('sell') ? 'Sell' : 'Buy'

        // 4. Qty (Groww: 'Qty.')
        const qtyRaw = keys['quantity'] || keys['qty'] || keys['execqty'] || keys['shares'] || keys['balance']
        const qty = cleanNumber(qtyRaw)

        // 5. Price (Groww: 'Avg. Cost')
        const priceRaw = keys['price'] || keys['rate'] || keys['avgprice'] || keys['avgcost'] || keys['buyprice']
        const price = cleanNumber(priceRaw)

        if (ticker && qty > 0 && price >= 0) {
            mappedData.push({
                ticker: ticker.toString().toUpperCase().trim(),
                date: finalDate,
                type: normType,
                quantity: Math.abs(qty),
                price: Math.abs(price),
                status: 'pending'
            })
        }
    })
    setPreview(mappedData)
  }

  // --- HEADER FINDER FOR EXCEL ---
  const parseExcel = (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          
          // Convert to array of arrays to find the header row
          const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
          
          let headerRowIndex = 0
          for (let i = 0; i < Math.min(rawData.length, 20); i++) {
              const rowStr = rawData[i].join(' ').toLowerCase()
              // Look for Groww specific headers
              if (rowStr.includes('instrument name') || rowStr.includes('symbol') || rowStr.includes('ticker')) {
                  headerRowIndex = i
                  break
              }
          }

          // Re-parse starting from the found header row
          const json = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex })
          processRows(json)
      }
      reader.readAsBinaryString(file)
  }

  // --- HEADER FINDER FOR CSV ---
  const parseCSV = (file: File) => {
    // First read as text to find header line
    const reader = new FileReader()
    reader.onload = (e) => {
        const text = e.target?.result as string
        const lines = text.split('\n')
        let headerLineIndex = 0
        
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const lineLower = lines[i].toLowerCase()
            if (lineLower.includes('instrument name') || lineLower.includes('symbol') || lineLower.includes('ticker')) {
                headerLineIndex = i
                break
            }
        }

        // Now pass the clean string (from header onwards) to PapaParse
        const cleanText = lines.slice(headerLineIndex).join('\n')
        
        Papa.parse(cleanText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => processRows(results.data)
        })
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
      if (preview.length === 0) return
      setUploading(true)
      setProgress(0)

      let finalPid = targetPortfolioId
      if (!finalPid && portfolios.length > 0) finalPid = portfolios[0].id as number
      if (!finalPid) {
           const { data: { user } } = await supabase.auth.getUser()
           if (user) {
               const { data } = await supabase.from('portfolios').select('id').eq('user_id', user.id).limit(1).single()
               if (data) finalPid = data.id
           }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let successCount = 0

      for (let i = 0; i < preview.length; i++) {
          const row = preview[i]
          try {
              let cleanTicker = row.ticker
              if (!cleanTicker.includes('.') && row.ticker.length < 10) cleanTicker += '.NS'

              const { data: asset, error: assetError } = await supabase
                  .from('assets')
                  .upsert({ ticker: cleanTicker, name: row.ticker, asset_type: 'Stock' }, { onConflict: 'ticker' })
                  .select('id')
                  .single()
              
              if (assetError) throw assetError

              const { error: txnError } = await supabase.from('transactions').insert({
                  user_id: user.id,
                  portfolio_id: finalPid,
                  asset_id: asset.id,
                  transaction_type: row.type,
                  quantity: row.quantity,
                  price: row.price,
                  date: row.date,
                  realised_pnl: 0 
              })

              if (txnError) throw txnError

              row.status = 'success'
              successCount++

          } catch (err: any) {
              console.error(err)
              row.status = 'error'
              row.msg = err.message
          }
          
          setProgress(Math.round(((i + 1) / preview.length) * 100))
      }

      setUploading(false)
      alert(`Import Complete! Successfully imported ${successCount} of ${preview.length} transactions.`)
      onSuccess()
      onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 max-h-[90vh] flex flex-col">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Import</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-6 w-6 text-slate-500" /></button>
        </div>

        {!file ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-12 bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                {/* DEFAULT DATE PICKER */}
                <div className="mb-6 w-full max-w-xs">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                        Default Date (Required for Holdings Report):
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                            type="date" 
                            value={defaultDate} 
                            onChange={(e) => setDefaultDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:bg-slate-800 dark:border-slate-700 text-sm"
                        />
                    </div>
                </div>

                <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full mb-4 dark:bg-indigo-900/30 dark:text-indigo-400">
                    <UploadCloud className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Upload Report</h3>
                <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
                    Supports <b>.CSV</b> and <b>.XLSX</b> (Groww, Zerodha).<br/>
                    We auto-skip header rows to find your data.
                </p>
                <label className="cursor-pointer rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition">
                    Select File
                    <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileChange} />
                </label>
            </div>
        ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <FileText className="h-4 w-4" />
                        {file.name} <span className="text-slate-400">({preview.length} rows)</span>
                    </div>
                    
                    <button onClick={() => { setFile(null); setPreview([]) }} className="text-xs text-red-500 hover:underline">Change File</button>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Import To Portfolio</label>
                    <select 
                        className="w-full p-2 text-sm border border-slate-300 rounded-lg dark:bg-slate-950 dark:border-slate-700"
                        onChange={(e) => setTargetPortfolioId(Number(e.target.value))}
                    >
                        {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200 rounded-lg dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                            <tr>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Ticker</th>
                                <th className="p-3 font-medium">Type</th>
                                <th className="p-3 font-medium text-right">Qty</th>
                                <th className="p-3 font-medium text-right">Price</th>
                                <th className="p-3 font-medium text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {preview.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-3 text-slate-500">{row.date}</td>
                                    <td className="p-3 font-medium">{row.ticker}</td>
                                    <td className={`p-3 font-medium ${row.type === 'Buy' ? 'text-green-600' : 'text-red-600'}`}>{row.type}</td>
                                    <td className="p-3 text-right">{row.quantity}</td>
                                    <td className="p-3 text-right">{row.price}</td>
                                    <td className="p-3 text-center">
                                        {row.status === 'pending' && <span className="text-slate-400">-</span>}
                                        {row.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />}
                                        {row.status === 'error' && (
                                            <span title={row.msg} className="flex items-center justify-center cursor-help">
                                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} disabled={uploading} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancel</button>
                    <button 
                        onClick={handleImport} 
                        disabled={uploading}
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {uploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Importing {progress}%</>
                        ) : (
                            'Import All'
                        )}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  )
}