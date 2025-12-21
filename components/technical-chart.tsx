'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, TrendingUp, BarChart2, Activity } from 'lucide-react'
import { calculateSMA, calculateEMA } from '@/lib/indicators'

const INTERVALS = [
  { label: '1m', value: '1m', range: '1d' },
  { label: '5m', value: '5m', range: '5d' },
  { label: '15m', value: '15m', range: '5d' },
  { label: '1H', value: '60m', range: '1mo' },
  { label: '4H', value: '60m', range: '3mo' }, // Yahoo approximation
  { label: '1D', value: '1d', range: '1y' },
  { label: '1W', value: '1wk', range: '5y' },
]

type Props = {
    symbol: string
}

function TechnicalChart({ symbol }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  
  // Series Refs
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const smaSeriesRef = useRef<any>(null)
  const emaSeriesRef = useRef<any>(null)

  const [interval, setIntervalState] = useState('15m')
  const [range, setRange] = useState('5d')
  const [loading, setLoading] = useState(true)
  
  // Indicator Toggles
  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showVolume, setShowVolume] = useState(true)

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' }, // Will handle dark mode later if needed
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#e5e7eb'
      },
      rightPriceScale: {
        borderColor: '#e5e7eb'
      }
    })

    // Handle Dark Mode dynamically
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark) {
        chart.applyOptions({
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            timeScale: { borderColor: '#334155' },
            rightPriceScale: { borderColor: '#334155' }
        })
    }

    // A. Volume Series (Histogram) - Added first so it sits behind candles
    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay on same scale but scaled down
    })
    // Scale volume to sit at bottom 15% of chart
    volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 }
    })
    volumeSeriesRef.current = volumeSeries

    // B. Candle Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // C. Indicators
    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20' })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50' })
    
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    chartRef.current = chart

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // 2. Fetch & Update Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/chart', {
            method: 'POST',
            body: JSON.stringify({ symbol, interval, range })
        })
        const data = await res.json()
        
        if (data.candles && chartRef.current) {
            // Update Candles
            candleSeriesRef.current.setData(data.candles)
            
            // Update Volume
            if (showVolume) {
                volumeSeriesRef.current.setData(data.volume)
                volumeSeriesRef.current.applyOptions({ visible: true })
            } else {
                volumeSeriesRef.current.applyOptions({ visible: false })
            }

            // Calculate & Update SMA (Period 20)
            if (showSMA) {
                const smaData = calculateSMA(data.candles, 20)
                smaSeriesRef.current.setData(smaData)
                smaSeriesRef.current.applyOptions({ visible: true })
            } else {
                smaSeriesRef.current.applyOptions({ visible: false })
            }

            // Calculate & Update EMA (Period 50)
            if (showEMA) {
                const emaData = calculateEMA(data.candles, 50)
                emaSeriesRef.current.setData(emaData)
                emaSeriesRef.current.applyOptions({ visible: true })
            } else {
                emaSeriesRef.current.applyOptions({ visible: false })
            }

            chartRef.current.timeScale().fitContent()
        }
      } catch (err) {
        console.error("Chart fetch error", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [symbol, interval, range, showSMA, showEMA, showVolume])

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      
      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-4">
        
        {/* Symbol Info */}
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="h-5 w-5" />
            </div>
            <div>
                <h3 className="font-bold text-slate-900 dark:text-white leading-none">{symbol}</h3>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Yahoo Finance Data</span>
            </div>
        </div>
        
        {/* Controls Container */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
            
            {/* Timeframe Selector */}
            <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
            {INTERVALS.map((int) => (
                <button
                key={int.value + int.range}
                onClick={() => { setIntervalState(int.value); setRange(int.range); }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all
                    ${interval === int.value 
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold" 
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                >
                {int.label}
                </button>
            ))}
            </div>

            {/* Indicators Toggles */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowSMA(!showSMA)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${showSMA ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800'}`}
                >
                    <Activity className="h-3 w-3" /> SMA 20
                </button>
                <button 
                    onClick={() => setShowEMA(!showEMA)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${showEMA ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800'}`}
                >
                    <Activity className="h-3 w-3" /> EMA 50
                </button>
                <button 
                    onClick={() => setShowVolume(!showVolume)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${showVolume ? 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300' : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800'}`}
                >
                    <BarChart2 className="h-3 w-3" /> Vol
                </button>
            </div>

        </div>
      </div>

      {/* CHART CANVAS */}
      <div className="relative h-[500px] w-full bg-white dark:bg-slate-900">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-10 backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
            <span className="text-xs text-slate-500 font-medium animate-pulse">Loading market data...</span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  )
}

export default memo(TechnicalChart)