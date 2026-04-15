'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, AlertTriangle, Layers, PieChart, Grid3X3, Eye, ChevronDown, ChevronUp } from 'lucide-react'

type Props = {
    mfTickers: string[]                    // MF tickers from user's portfolio
    mfNames: Record<string, string>        // ticker → human-readable fund name
    mfWeights: Record<string, number>      // ticker → portfolio weight (0-100)
    directStocks: { ticker: string, name: string, weight: number }[]  // direct stock holdings
}

type Holding = { name: string, weight: number, symbol?: string }
type SectorWeight = { sector: string, weight: number }
type FundData = {
    ticker: string
    fundName: string
    holdings: Holding[]
    sectorWeights: SectorWeight[]
    error?: string
}

const fmtPct = (n: number) => `${n.toFixed(1)}%`

export default function MfXray({ mfTickers, mfNames, mfWeights, directStocks }: Props) {
    const [funds, setFunds] = useState<FundData[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showAllStocks, setShowAllStocks] = useState(false)
    const [cached, setCached] = useState(false)

    const fetchXray = (forceRefresh = false) => {
        if (mfTickers.length === 0) return
        setLoading(true)
        setError(null)
        setCached(false)

        fetch('/api/mf-xray', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: mfTickers, names: mfNames, forceRefresh }),
        })
            .then(r => r.json())
            .then(data => {
                if (data.error) setError(data.error)
                else {
                    setFunds(data.funds || [])
                    setCached(data.cached || false)
                }
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchXray()
    }, [mfTickers])

    // ═══════════════════════════════════════════════════
    //  ANALYSIS
    // ═══════════════════════════════════════════════════
    const analysis = useMemo(() => {
        const validFunds = funds.filter(f => f.holdings.length > 0)
        if (validFunds.length === 0) return null

        // 1. UNIFIED TOP STOCK EXPOSURE (MF underlying + direct stocks)
        const stockExposure: Record<string, { weight: number, sources: string[] }> = {}

        // Add MF underlying holdings (weighted by MF's portfolio weight)
        validFunds.forEach(fund => {
            const fundWeight = mfWeights[fund.ticker] || 0
            fund.holdings.forEach(h => {
                const key = h.name.toUpperCase()
                if (!stockExposure[key]) stockExposure[key] = { weight: 0, sources: [] }
                stockExposure[key].weight += (h.weight * fundWeight) / 100
                const fundLabel = fund.fundName.replace(/\s*(Direct|Growth|Plan|Regular|-)\s*/gi, ' ').trim().substring(0, 20)
                if (!stockExposure[key].sources.includes(fundLabel)) stockExposure[key].sources.push(fundLabel)
            })
        })

        // Add direct stock holdings
        directStocks.forEach(s => {
            const key = s.ticker.toUpperCase().replace('.NS', '').replace('.BO', '')
            if (!stockExposure[key]) stockExposure[key] = { weight: 0, sources: [] }
            stockExposure[key].weight += s.weight
            stockExposure[key].sources.push('Direct')
        })

        const topStocks = Object.entries(stockExposure)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.weight - a.weight)

        // 2. UNIFIED SECTOR EXPOSURE
        const sectorExposure: Record<string, number> = {}
        validFunds.forEach(fund => {
            const fundWeight = mfWeights[fund.ticker] || 0
            fund.sectorWeights.forEach(sw => {
                sectorExposure[sw.sector] = (sectorExposure[sw.sector] || 0) + (sw.weight * fundWeight) / 100
            })
        })
        const sectors = Object.entries(sectorExposure)
            .map(([sector, weight]) => ({ sector, weight }))
            .sort((a, b) => b.weight - a.weight)

        // 3. OVERLAP MATRIX
        const overlapMatrix: { fund1: string, fund2: string, overlap: number }[] = []
        for (let i = 0; i < validFunds.length; i++) {
            for (let j = i + 1; j < validFunds.length; j++) {
                const f1Holdings = new Set(validFunds[i].holdings.map(h => h.name.toUpperCase()))
                const f2Holdings = new Set(validFunds[j].holdings.map(h => h.name.toUpperCase()))
                const commonCount = [...f1Holdings].filter(h => f2Holdings.has(h)).length
                const totalUnique = new Set([...f1Holdings, ...f2Holdings]).size
                const overlap = totalUnique > 0 ? (commonCount / totalUnique) * 100 : 0
                const label = (f: FundData) => f.fundName.replace(/\s*(Direct|Growth|Plan|Regular|-)\s*/gi, ' ').trim().substring(0, 25)
                overlapMatrix.push({
                    fund1: label(validFunds[i]),
                    fund2: label(validFunds[j]),
                    overlap
                })
            }
        }

        // 4. CONCENTRATION WARNINGS
        const warnings: string[] = []
        const highConcentration = topStocks.filter(s => s.weight > 10)
        highConcentration.forEach(s => {
            if (s.sources.length > 1) {
                warnings.push(`${s.name} is ${fmtPct(s.weight)} of your portfolio via ${s.sources.join(', ')}`)
            }
        })
        if (topStocks.length > 0 && topStocks.slice(0, 3).reduce((s, t) => s + t.weight, 0) > 25) {
            warnings.push(`Top 3 stocks make up ${fmtPct(topStocks.slice(0, 3).reduce((s, t) => s + t.weight, 0))} of your portfolio`)
        }

        return { topStocks, sectors, overlapMatrix, warnings, validFunds }
    }, [funds, mfWeights, directStocks])

    if (mfTickers.length === 0) {
        return <div className="text-center text-sm text-slate-400 py-8">No mutual fund holdings found in your portfolio.</div>
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-400">Scanning mutual fund holdings...</p>
            </div>
        )
    }

    if (error) {
        return <div className="text-center text-sm text-red-400 py-8">Error: {error}</div>
    }

    if (!analysis) {
        return <div className="text-center text-sm text-slate-400 py-8">Could not fetch holdings data for your mutual funds. Ensure tickers are Yahoo-compatible.</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/20">
                    <Eye className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">Mutual Fund X-Ray</h3>
                        {cached && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-400">cached</span>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400">Look-through analysis of {analysis.validFunds.length} fund(s)</p>
                </div>
                {cached && (
                    <button
                        onClick={() => fetchXray(true)}
                        className="text-xs text-slate-400 hover:text-indigo-500 transition flex items-center gap-1"
                    >
                        ↻ Refresh
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">

                {/* 1. TOP STOCK EXPOSURE */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-indigo-500" />
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">True Stock Exposure</h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-semibold">{analysis.topStocks.length}</span>
                        </div>
                    </div>
                    <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                        {(showAllStocks ? analysis.topStocks : analysis.topStocks.slice(0, 15)).map((s, i) => (
                            <div key={s.name} className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-slate-700 dark:text-white">{s.name}</span>
                                        <span className={`text-xs font-bold ${s.weight > 10 ? 'text-red-500' : s.weight > 5 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {fmtPct(s.weight)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {s.sources.map((src, j) => (
                                            <span key={j} className={`text-[9px] px-1.5 py-0.5 rounded-full ${src === 'Direct' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                {src}
                                            </span>
                                        ))}
                                    </div>
                                    {/* Weight bar */}
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-1">
                                        <div
                                            className={`h-full rounded-full ${s.weight > 10 ? 'bg-red-400' : s.weight > 5 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                                            style={{ width: `${Math.min(s.weight * 3, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {analysis.topStocks.length > 15 && (
                            <button
                                onClick={() => setShowAllStocks(!showAllStocks)}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition"
                            >
                                {showAllStocks ? (
                                    <><ChevronUp className="h-3.5 w-3.5" /> Show Less</>
                                ) : (
                                    <><ChevronDown className="h-3.5 w-3.5" /> Show All {analysis.topStocks.length} Stocks</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. SECTOR EXPOSURE */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                        <PieChart className="h-4 w-4 text-emerald-500" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">True Sector Exposure</h4>
                    </div>
                    <div className="space-y-2.5 flex-1 overflow-y-auto min-h-0">
                        {analysis.sectors.map(s => (
                            <div key={s.sector}>
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <span className="text-xs text-slate-600 dark:text-slate-300">{s.sector}</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-white">{fmtPct(s.weight)}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                                        style={{ width: `${Math.min(s.weight * 2, 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {analysis.sectors.length === 0 && (
                            <p className="text-xs text-slate-400">Sector data not available for these funds</p>
                        )}
                    </div>
                </div>

                {/* 3. OVERLAP MATRIX */}
                {analysis.overlapMatrix.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Grid3X3 className="h-4 w-4 text-sky-500" />
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">Fund Overlap</h4>
                        </div>
                        <div className="space-y-3">
                            {analysis.overlapMatrix.map((pair, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-[10px] text-slate-500">{pair.fund1} ↔ {pair.fund2}</span>
                                            <span className={`text-xs font-bold ${pair.overlap > 50 ? 'text-red-500' : pair.overlap > 25 ? 'text-amber-500' : 'text-green-500'}`}>
                                                {fmtPct(pair.overlap)} overlap
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                            <div
                                                className={`h-full rounded-full ${pair.overlap > 50 ? 'bg-red-400' : pair.overlap > 25 ? 'bg-amber-400' : 'bg-green-400'}`}
                                                style={{ width: `${pair.overlap}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. CONCENTRATION WARNINGS */}
                {analysis.warnings.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400">Concentration Warnings</h4>
                        </div>
                        <div className="space-y-2">
                            {analysis.warnings.map((w, i) => (
                                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-amber-100 dark:border-amber-900/30 last:border-0">
                                    <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-300">{w}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
