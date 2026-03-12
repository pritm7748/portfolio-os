'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import UltimateAnalysis from '@/components/ultimate-analysis/index'

export default function StockAnalysisPage() {
    const params = useParams()
    const router = useRouter()
    const ticker = decodeURIComponent(params.ticker as string)

    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/stock-analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker })
                })
                if (!res.ok) throw new Error('Failed to fetch analysis data')
                const json = await res.json()
                setData(json)
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        if (ticker) fetchData()
    }, [ticker])

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                    <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Analysis
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                        {ticker.replace('.NS', '').replace('.BO', '')}
                    </p>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Fetching data from multiple sources...
                    </p>
                </div>
            ) : error ? (
                <div className="text-center py-20">
                    <p className="text-red-500 font-medium">{error}</p>
                    <button onClick={() => router.back()} className="mt-4 text-sm text-indigo-600 hover:underline">
                        ← Go back
                    </button>
                </div>
            ) : data ? (
                <UltimateAnalysis ticker={ticker} data={data} />
            ) : null}
        </div>
    )
}
