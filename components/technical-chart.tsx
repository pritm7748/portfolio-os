'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, TrendingUp, BarChart2, Activity, Zap } from 'lucide-react'
import { calculateSMA, calculateEMA, calculateRSI } from '@/lib/indicators'

const INTERVALS = [
  { label: '1m', value: '1m', range: '1d' },
  { label: '5m', value: '5m', range: '5d' },
  { label: '15m', value: '15m', range: '5d' },
  { label: '1H', value: '60m', range: '3mo' },
  { label: '1D', value: '1d', range: '2y' },
  { label: '1W', value: '1wk', range: '5y' },
  { label: 'ALL', value: '1mo', range: 'max' }, // All Time
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

  const [interval, setIntervalState] = useState('1D')
  const [range, setRange] = useState('2y')
  const [loading, setLoading] = useState(true)
  
  // Indicator Toggles
  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showRSI, setShowRSI] = useState(false)
  
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
      height: 550, // Taller for indicators
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
    })

    // Dark Mode Handling
    if (document.documentElement.classList.contains('dark')) {
        chart.applyOptions({
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            timeScale: { borderColor: '#334155' },
            rightPriceScale: { borderColor: '#334155' }
        })
    }

    // A. Volume (Bottom Layer)
    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay
    })
    volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 } // Push to very bottom
    })
    volumeSeriesRef.current = volumeSeries

    // B. Candles (Main)
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
    
    // RSI: Use Left Scale to avoid messing up price
    const rsiSeries = chart.addSeries(LineSeries, { 
        color: '#8b5cf6', 
        lineWidth: 2, 
        priceScaleId: 'left', // Separate scale
        title: 'RSI 14'
    })
    
    // Configure RSI Scale (0-100)
    chart.priceScale('left').applyOptions({
        visible: false, // Hide the numbers to keep it clean, or true if you want to see 0-100
        scaleMargins: { top: 0.7, bottom: 0 } // Position it at bottom overlaying volume
    })

    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries
    rsiSeriesRef.current = rsiSeries
    chartRef.current = chart

    // --- CROSSHAIR LISTENER (THE LEGEND) ---
    chart.subscribeCrosshairMove((param) => {
        if (param.time) {
            const data: any = {}
            // Get Candle Data
            const candle = param.seriesData.get(candleSeries) as any
            if (candle) {
                data.open = candle.open; data.high = candle.high; 
                data.low = candle.low; data.close = candle.close;
                // Format Date
                const dateObj = new Date(Number(param.time) * 1000)
                data.date = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
            }
            
            // Get Indicators
            if (showSMA) {
                const sma = param.seriesData.get(smaSeries) as any
                if (sma) data.sma = sma.value
            }
            if (showEMA) {
                const ema = param.seriesData.get(emaSeries) as any
                if (ema) data.ema = ema.value
            }
            if (showRSI) {
                const rsi = param.seriesData.get(rsiSeries) as any
                if (rsi) data.rsi = rsi.value
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
  }, [showSMA, showEMA, showRSI])

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
            // Update Candles & Volume
            candleSeriesRef.current.setData(data.candles)
            volumeSeriesRef.current.setData(data.volume)

            // Indicators Calculation
            if (showSMA) {
                const smaData = calculateSMA(data.candles, 20)
                smaSeriesRef.current.setData(smaData)
                smaSeriesRef.current.applyOptions({ visible: true })
            } else {
                smaSeriesRef.current.applyOptions({ visible: false })
            }

            if (showEMA) {
                const emaData = calculateEMA(data.candles, 50)
                emaSeriesRef.current.setData(emaData)
                emaSeriesRef.current.applyOptions({ visible: true })
            } else {
                emaSeriesRef.current.applyOptions({ visible: false })
            }

            if (showRSI) {
                const rsiData = calculateRSI(data.candles, 14)
                rsiSeriesRef.current.setData(rsiData)
                rsiSeriesRef.current.applyOptions({ visible: true })
                // Make left scale visible if RSI is on
                chartRef.current.priceScale('left').applyOptions({ visible: true })
            } else {
                rsiSeriesRef.current.applyOptions({ visible: false })
                chartRef.current.priceScale('left').applyOptions({ visible: false })
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
  }, [symbol, interval, range, showSMA, showEMA, showRSI])

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-2">
        
        {/* Symbol & Live Legend */}
        <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{symbol}</h3>
                {legendData && (
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {legendData.date}
                    </span>
                )}
            </div>
            
            {/* THE LEGEND OVERLAY (Always Visible Logic) */}
            <div className="flex items-center gap-4 text-xs font-mono mt-1 h-4">
                {legendData ? (
                    <>
                        <span className="text-slate-600 dark:text-slate-300">O: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.open}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">H: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.high}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">L: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.low}</span></span>
                        <span className="text-slate-600 dark:text-slate-300">C: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.close}</span></span>
                        
                        {showSMA && legendData.sma && <span className="text-blue-500">SMA: {legendData.sma.toFixed(2)}</span>}
                        {showEMA && legendData.ema && <span className="text-amber-500">EMA: {legendData.ema.toFixed(2)}</span>}
                        {showRSI && legendData.rsi && <span className="text-purple-500">RSI: {legendData.rsi.toFixed(2)}</span>}
                    </>
                ) : (
                    <span className="text-slate-400 italic">Hover over chart for details</span>
                )}
            </div>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
            
            {/* Timeframe */}
            <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
            {INTERVALS.map((int) => (
                <button
                key={int.value + int.range}
                onClick={() => { setIntervalState(int.value); setRange(int.range); }}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase
                    ${interval === int.value 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                >
                {int.label}
                </button>
            ))}
            </div>

            {/* Indicators */}
            <div className="flex items-center gap-1">
                <button onClick={() => setShowSMA(!showSMA)} className={`p-1.5 rounded text-xs font-bold border ${showSMA ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800'}`}>SMA</button>
                <button onClick={() => setShowEMA(!showEMA)} className={`p-1.5 rounded text-xs font-bold border ${showEMA ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800'}`}>EMA</button>
                <button onClick={() => setShowRSI(!showRSI)} className={`p-1.5 rounded text-xs font-bold border ${showRSI ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800'}`}>RSI</button>
            </div>

        </div>
      </div>

      {/* CHART CANVAS */}
      <div className="relative flex-1 w-full bg-white dark:bg-slate-900 min-h-[500px]">
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