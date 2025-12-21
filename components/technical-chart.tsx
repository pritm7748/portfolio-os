'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, TrendingUp, BarChart2, Activity, Zap } from 'lucide-react'
import { calculateSMA, calculateEMA, calculateRSI } from '@/lib/indicators'

const INTERVALS = [
  { label: '1D', value: '1d', range: '2y' },
  { label: '1W', value: '1wk', range: '5y' },
  { label: 'ALL', value: '1mo', range: 'max' },
  { label: '1m', value: '1m', range: '1d' },
  { label: '5m', value: '5m', range: '5d' },
  { label: '15m', value: '15m', range: '5d' },
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
  const rsiSeriesRef = useRef<any>(null)

  const [interval, setIntervalState] = useState('1d')
  const [range, setRange] = useState('2y')
  const [loading, setLoading] = useState(true)
  
  // Indicator Toggles
  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showRSI, setShowRSI] = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  
  // Dynamic Legend State
  const [legendData, setLegendData] = useState<any>(null)

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 550,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#e5e7eb'
      },
      rightPriceScale: {
        borderColor: '#e5e7eb',
        scaleMargins: { top: 0.1, bottom: 0.25 } // Bottom space for Vol + RSI
      }
    })

    // Dark Mode Support
    if (document.documentElement.classList.contains('dark')) {
        chart.applyOptions({
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            timeScale: { borderColor: '#334155' },
            rightPriceScale: { borderColor: '#334155' }
        })
    }

    // A. Volume (Layer 0 - Bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay mode
    })
    volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 } // Bottom 20%
    })
    volumeSeriesRef.current = volumeSeries

    // B. RSI (Layer 1 - Overlay)
    const rsiSeries = chart.addSeries(LineSeries, { 
        color: '#a855f7', 
        lineWidth: 1, 
        priceScaleId: 'left',
        title: 'RSI'
    })
    chart.priceScale('left').applyOptions({
        visible: false, // Hide scale numbers to keep clean
        scaleMargins: { top: 0.8, bottom: 0 } // Same height as volume
    })
    rsiSeriesRef.current = rsiSeries

    // C. Candles (Layer 2 - Main)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // D. Moving Averages
    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20', priceScaleId: 'right' })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50', priceScaleId: 'right' })
    
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries
    chartRef.current = chart

    // --- CROSSHAIR LISTENER ---
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
            if (showRSI) {
                const r = param.seriesData.get(rsiSeries) as any
                if (r) data.rsi = r.value
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
  }, [showSMA, showEMA, showRSI, showVolume])

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
        
        if (data.candles && data.candles.length > 0 && chartRef.current) {
            candleSeriesRef.current.setData(data.candles)
            
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

            if (showRSI) {
                rsiSeriesRef.current.setData(calculateRSI(data.candles, 14))
                rsiSeriesRef.current.applyOptions({ visible: true })
            } else {
                rsiSeriesRef.current.applyOptions({ visible: false })
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
  }, [symbol, interval, range, showSMA, showEMA, showRSI, showVolume])

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-2">
        <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{symbol}</h3>
                {legendData && <span className="text-xs font-mono text-slate-500">{legendData.date}</span>}
            </div>
            
            <div className="flex items-center gap-4 text-xs font-mono mt-1 h-4">
                {legendData ? (
                    <>
                        <span className="text-slate-600 dark:text-slate-300">O: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.open}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">H: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.high}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">L: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.low}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">C: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.close}</span></span>
                        {legendData.rsi && <span className="text-purple-500">RSI: {legendData.rsi.toFixed(2)}</span>}
                    </>
                ) : <span className="text-slate-400 italic">Hover for details</span>}
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
            {INTERVALS.map((int) => (
                <button
                key={int.value + int.range}
                onClick={() => { setIntervalState(int.value); setRange(int.range); }}
                className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${interval === int.value ? "bg-indigo-600 text-white" : "text-slate-500"}`}
                >
                {int.label}
                </button>
            ))}
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => setShowSMA(!showSMA)} className={`p-1.5 rounded text-xs font-bold border ${showSMA ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500'}`}>SMA</button>
                <button onClick={() => setShowEMA(!showEMA)} className={`p-1.5 rounded text-xs font-bold border ${showEMA ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-500'}`}>EMA</button>
                <button onClick={() => setShowRSI(!showRSI)} className={`p-1.5 rounded text-xs font-bold border ${showRSI ? 'bg-purple-100 text-purple-700' : 'bg-white text-slate-500'}`}>RSI</button>
            </div>
        </div>
      </div>

      <div className="relative flex-1 w-full min-h-[500px]">
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10"><Loader2 className="animate-spin text-indigo-500" /></div>}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  )
}

export default memo(TechnicalChart)