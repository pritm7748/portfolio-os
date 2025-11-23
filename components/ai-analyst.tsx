// components/ai-analyst.tsx
'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'

type Props = {
  data: any // The portfolio summary object
}

export default function AIAnalyst({ data }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generateAnalysis = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ portfolioData: data }),
      })
      const result = await res.json()
      setAnalysis(result.analysis)
    } catch (e) {
      console.error(e)
      setAnalysis('<p>Failed to generate analysis. Please try again.</p>')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm dark:border-indigo-900 dark:from-slate-900 dark:to-slate-950">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-indigo-600 p-1.5 text-white shadow-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Portfolio Analyst</h3>
        </div>
        
        {!analysis && (
            <button 
                onClick={generateAnalysis}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-all"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Insights
            </button>
        )}
        
        {analysis && (
             <button 
                onClick={generateAnalysis}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-indigo-600 transition"
                title="Regenerate"
             >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
             </button>
        )}
      </div>

      {/* Content Area */}
      <div className="min-h-[100px]">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-32 space-y-3 text-slate-500 animate-pulse">
                <div className="h-2 w-3/4 bg-slate-200 rounded dark:bg-slate-800"></div>
                <div className="h-2 w-1/2 bg-slate-200 rounded dark:bg-slate-800"></div>
                <div className="h-2 w-5/6 bg-slate-200 rounded dark:bg-slate-800"></div>
                <span className="text-xs">Analyzing your holdings...</span>
            </div>
        ) : analysis ? (
            <div 
                className="prose prose-sm max-w-none text-slate-600 dark:text-slate-300 dark:prose-headings:text-slate-200 dark:prose-strong:text-indigo-300"
                dangerouslySetInnerHTML={{ __html: analysis }} 
            />
        ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Click the button above to get a personalized investment report based on your current holdings, performance, and sector allocation.
            </p>
        )}
      </div>
    </div>
  )
}