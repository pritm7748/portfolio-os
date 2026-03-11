'use client'

import { useState } from 'react'
import { Brain, Loader2, ExternalLink } from 'lucide-react'

type Props = {
    ticker: string
    concallLinks: { title: string; url: string }[]
}

export default function ConcallTab({ ticker, concallLinks }: Props) {
    const [analysis, setAnalysis] = useState('')
    const [loading, setLoading] = useState(false)
    const [hasRun, setHasRun] = useState(false)

    const runAnalysis = async (transcriptUrl?: string) => {
        setLoading(true)
        setHasRun(true)
        try {
            const res = await fetch('/api/concall-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.replace('.NS', '').replace('.BO', ''),
                    transcriptUrl
                })
            })
            const data = await res.json()
            setAnalysis(data.analysis || 'No analysis generated')
        } catch (e: any) {
            setAnalysis(`<p class="text-red-500">Error: ${e.message}</p>`)
        } finally {
            setLoading(false)
        }
    }

    const cleanTicker = ticker.replace('.NS', '').replace('.BO', '')

    return (
        <div className="space-y-6">
            {/* Action Card */}
            {!hasRun && (
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/10 dark:to-violet-900/10 rounded-xl border border-indigo-200 dark:border-indigo-800 p-8 text-center">
                    <Brain className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Concall Intelligence</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                        AI-powered analysis of {cleanTicker}'s latest earnings call.
                        Get management guidance, growth outlook, risk factors, and bull/bear case.
                    </p>

                    {concallLinks?.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">Available transcripts:</p>
                            <div className="flex flex-col gap-2 items-center">
                                {concallLinks.map((link, i) => (
                                    <button
                                        key={i}
                                        onClick={() => runAnalysis(link.url)}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
                                    >
                                        <Brain className="h-4 w-4" />
                                        Analyze: {link.title || `Transcript ${i + 1}`}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800">
                                <button
                                    onClick={() => runAnalysis()}
                                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    Or run general AI analysis without transcript →
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-400 italic mb-3">No transcript links found on Screener</p>
                            <button
                                onClick={() => runAnalysis()}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
                            >
                                <Brain className="h-4 w-4" />
                                Run AI Analysis for {cleanTicker}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="relative">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                        <Brain className="h-5 w-5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Analyzing with Gemini AI...</p>
                        <p className="text-xs text-slate-500 mt-1">This may take 10-15 seconds</p>
                    </div>
                </div>
            )}

            {/* Analysis Result */}
            {analysis && !loading && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-indigo-500" />
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">AI Analysis — {cleanTicker}</h4>
                        </div>
                        <button
                            onClick={() => { setHasRun(false); setAnalysis('') }}
                            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            Run Again
                        </button>
                    </div>
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                        dangerouslySetInnerHTML={{ __html: analysis }}
                    />
                </div>
            )}
        </div>
    )
}
