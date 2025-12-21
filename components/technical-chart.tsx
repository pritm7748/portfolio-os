'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, TrendingUp, BarChart2, Activity } from 'lucide-react'
import { calculateSMA, calculateEMA } from '@/lib/indicators'

// Exact Timeframes Requested
const INTERVALS = [
  { label: '1m', value: '1m', range: '7d' },
  { label: '5m', value: '5m', range: '60d' },
  { label: '15m', value: '15m', range: '60d' },
  { label: '30m', value: '30m', range: '60d' },
  { label: '1H', value: '60m', range: '730d' },
  { label: '4H', value: '60m', range: '730d' },
  { label: '1D', value: '1d', range: '10y' },
  { label: '1W', value: '1wk', range: '10y' },
  { label: '1M', value: '1mo', range: 'max' },
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

  const [interval, setIntervalState] = useState('1D')
  const [range, setRange] = useState('10y')
  const [activeLabel, setActiveLabel] = useState('1D')
  const [loading, setLoading] = useState(true)
  
  // Indicators (Default: TRUE)
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  
  const [legendData, setLegendData] = useState<any>(null)

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
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
        borderColor: '#e5e7eb',
        scaleMargins: { top: 0.1, bottom: 0.2 } // Leave space for volume
      }
    }

    // Dark Mode Support
    if (document.documentElement.classList.contains('dark')) {
        Object.assign(chartOptions, {
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            timeScale: { borderColor: '#334155' },
            rightPriceScale: { borderColor: '#334155' }
        })
    }

    const chart = createChart(chartContainerRef.current, chartOptions)

    // A. Volume (Layer 0 - Bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay mode
    })
    volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 }
    })
    volumeSeriesRef.current = volumeSeries

    // B. Candles (Layer 1 - Main)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // C. Indicators (Layer 2 - Lines)
    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20' })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50' })
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    chartRef.current = chart

    // Legend Logic
    chart.subscribeCrosshairMove((param) => {
        if (param.time) {
            const data: any = {}
            const candle = param.seriesData.get(candleSeries) as any
            if (candle) {
                data.open = candle.open; data.high = candle.high; 
                data.low = candle.low; data.close = candle.close;
                const dateObj = new Date(Number(param.time) * 1000)
                data.date = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
            }
            if (showSMA) {
                const s = param.seriesData.get(smaSeries) as any
                if (s) data.sma = s.value
            }
            if (showEMA) {
                const e = param.seriesData.get(emaSeries) as any
                if (e) data.ema = e.value
            }
            setLegendData(data)
        } else {
            setLegendData(null)
        }
    })

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
  }, []) // Init once

  // 2. Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/chart', {
            method: 'POST',
            body: JSON.stringify({ symbol, interval, range })
        })
        const data = await res.json()
        
        if (data.candles && data.candles.length > 0 && chartRef.current) {
            
            // Set Data
            candleSeriesRef.current.setData(data.candles)
            
            // Indicators
            if (showVolume) {
                volumeSeriesRef.current.setData(data.volume)
                volumeSeriesRef.current.applyOptions({ visible: true })
            } else {
                volumeSeriesRef.current.applyOptions({ visible: false })
            }

            if (showSMA) {
                smaSeriesRef.current.setData(calculateSMA(data.candles, 20))
                smaSeriesRef.current.applyOptions({ visible: true })
            } else {
                smaSeriesRef.current.applyOptions({ visible: false })
            }

            if (showEMA) {
                emaSeriesRef.current.setData(calculateEMA(data.candles, 50))
                emaSeriesRef.current.applyOptions({ visible: true })
            } else {
                emaSeriesRef.current.applyOptions({ visible: false })
            }

            // AUTO-FIT FIX: Small timeout to ensure chart renders correctly on first load
            setTimeout(() => {
                chartRef.current?.timeScale().fitContent()
            }, 100)
        }
      } catch (err) {
        console.error("Chart fetch error", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [symbol, interval, range, showSMA, showEMA, showVolume])

  const handleTimeframe = (lbl: string, val: string, rng: string) => {
      setActiveLabel(lbl)
      setIntervalState(val)
      setRange(rng)
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-4">
        
        {/* Symbol Info */}
        <div className="flex flex-col min-w-[200px]">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{symbol}</h3>
                {legendData && <span className="text-xs font-mono text-slate-500">{legendData.date}</span>}
            </div>
            
            <div className="flex items-center gap-3 text-xs font-mono mt-1 h-4 overflow-hidden">
                {legendData ? (
                    <>
                        <span className="text-slate-600 dark:text-slate-300">O: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.open}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">H: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.high}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">L: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.low}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">C: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.close}</span></span>
                        
                        {showSMA && legendData.sma && <span className="text-blue-500 ml-2">SMA: {legendData.sma.toFixed(2)}</span>}
                        {showEMA && legendData.ema && <span className="text-amber-500 ml-2">EMA: {legendData.ema.toFixed(2)}</span>}
                    </>
                ) : <span className="text-slate-400 italic">Hover for details</span>}
            </div>
        </div>
        
        {/* CONTROLS (Scrollable on Mobile) */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto scrollbar-hide">
            {/* Timeframe Buttons */}
            <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1 shrink-0">
                {INTERVALS.map((int) => (
                    <button
                        key={int.label}
                        onClick={() => handleTimeframe(int.label, int.value, int.range)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase transition-colors whitespace-nowrap
                            ${activeLabel === int.label
                            ? "bg-indigo-600 text-white shadow-sm" 
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            }`}
                    >
                    {int.label}
                    </button>
                ))}
            </div>

            {/* Indicators */}
            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3 shrink-0">
                <button onClick={() => setShowSMA(!showSMA)} className={`px-2.5 py-1.5 rounded text-[10px] font-bold border transition-colors ${showSMA ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>SMA</button>
                <button onClick={() => setShowEMA(!showEMA)} className={`px-2.5 py-1.5 rounded text-[10px] font-bold border transition-colors ${showEMA ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>EMA</button>
                <button onClick={() => setShowVolume(!showVolume)} className={`px-2.5 py-1.5 rounded text-[10px] font-bold border transition-colors ${showVolume ? 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>VOL</button>
            </div>
        </div>
      </div>

      {/* CHART CANVAS */}
      <div className="relative flex-1 w-full bg-white dark:bg-slate-900 min-h-[500px]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-[1px]">
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