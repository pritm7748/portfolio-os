'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, TrendingUp, BarChart2, Activity, Zap, Clock } from 'lucide-react'
import { calculateSMA, calculateEMA, calculateRSI } from '@/lib/indicators'

// Optimized Interval Mapping for Maximum History
const INTERVALS = [
  { label: '1m', value: '1m', range: '7d' },   // Max ~7 days for 1m
  { label: '5m', value: '5m', range: '60d' },  // Max ~60 days for 5m
  { label: '15m', value: '15m', range: '60d' },
  { label: '30m', value: '30m', range: '60d' },
  { label: '1H', value: '60m', range: '730d' }, // 2 years
  { label: '4H', value: '60m', range: '730d' }, // Yahoo doesn't support 4h native, using 1h
  { label: '1D', value: '1d', range: '10y' },
  { label: '1W', value: '1wk', range: '10y' },
  { label: '1M', value: '1mo', range: 'max' },
]

type Props = {
    symbol: string
}

function TechnicalChart({ symbol }: Props) {
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  
  const mainChartRef = useRef<any>(null)
  const rsiChartRef = useRef<any>(null)
  
  // Series Refs
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const smaSeriesRef = useRef<any>(null)
  const emaSeriesRef = useRef<any>(null)
  const rsiSeriesRef = useRef<any>(null)

  const [interval, setIntervalState] = useState('15m')
  const [range, setRange] = useState('60d')
  const [activeLabel, setActiveLabel] = useState('15m')
  const [loading, setLoading] = useState(true)
  
  // Toggles
  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showRSI, setShowRSI] = useState(true) // Default to true since we have a dedicated pane
  const [showVolume, setShowVolume] = useState(true)
  
  const [legendData, setLegendData] = useState<any>(null)

  // 1. Initialize Charts (Main + RSI)
  useEffect(() => {
    if (!mainContainerRef.current || !rsiContainerRef.current) return

    // --- COMMON OPTIONS ---
    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#e5e7eb'
      },
      rightPriceScale: {
        borderColor: '#e5e7eb',
      }
    }

    // Dark Mode Handling
    if (document.documentElement.classList.contains('dark')) {
        Object.assign(chartOptions, {
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            timeScale: { borderColor: '#334155' },
            rightPriceScale: { borderColor: '#334155' }
        })
    }

    // --- MAIN CHART ---
    const mainChart = createChart(mainContainerRef.current, {
        ...chartOptions,
        width: mainContainerRef.current.clientWidth,
        height: 400, // Main height
    })

    // Volume (Histogram)
    const volumeSeries = mainChart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay
    })
    volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 } // Push to bottom
    })
    volumeSeriesRef.current = volumeSeries

    // Candles
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // Indicators (Overlay)
    const smaSeries = mainChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20' })
    const emaSeries = mainChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50' })
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    // --- RSI CHART (Separate Pane) ---
    const rsiChart = createChart(rsiContainerRef.current, {
        ...chartOptions,
        width: rsiContainerRef.current.clientWidth,
        height: 150, // Small height
        timeScale: { visible: true, timeVisible: true, borderColor: '#e5e7eb' },
    })
    
    // RSI Line
    const rsiSeries = rsiChart.addSeries(LineSeries, { 
        color: '#8b5cf6', 
        lineWidth: 2,
        title: 'RSI 14'
    })
    // RSI Reference Lines (70/30)
    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
    rsiSeries.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
    
    rsiSeriesRef.current = rsiSeries

    mainChartRef.current = mainChart
    rsiChartRef.current = rsiChart

    // --- SYNCHRONIZATION LOGIC ---
    // Sync Time Scale (Scrolling)
    const mainTimeScale = mainChart.timeScale()
    const rsiTimeScale = rsiChart.timeScale()

    mainTimeScale.subscribeVisibleTimeRangeChange((range) => {
        if (range) rsiTimeScale.setVisibleRange(range)
    })

    rsiTimeScale.subscribeVisibleTimeRangeChange((range) => {
        if (range) mainTimeScale.setVisibleRange(range)
    })

    // Sync Crosshair (Hover)
    mainChart.subscribeCrosshairMove((param) => {
        if (param.time) {
            rsiChart.setCrosshairPosition(0, param.time, rsiSeries)
            
            // Legend Update
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
            rsiChart.clearCrosshairPosition()
            setLegendData(null)
        }
    })

    rsiChart.subscribeCrosshairMove((param) => {
        if (param.time) {
            mainChart.setCrosshairPosition(0, param.time, candleSeries)
            // RSI Legend Update
            const r = param.seriesData.get(rsiSeries) as any
            if (r) {
                setLegendData((prev: any) => ({ ...prev, rsi: r.value }))
            }
        } else {
            mainChart.clearCrosshairPosition()
        }
    })

    const handleResize = () => {
      if (mainContainerRef.current && mainChartRef.current && rsiContainerRef.current && rsiChartRef.current) {
        const w = mainContainerRef.current.clientWidth
        mainChartRef.current.applyOptions({ width: w })
        rsiChartRef.current.applyOptions({ width: w })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      mainChart.remove()
      rsiChart.remove()
    }
  }, []) // Initialize once

  // 2. Data Fetch & Update
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/chart', {
            method: 'POST',
            body: JSON.stringify({ symbol, interval, range })
        })
        const data = await res.json()
        
        if (data.candles && data.candles.length > 0) {
            // Update Main Chart
            if (mainChartRef.current) {
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
                
                mainChartRef.current.timeScale().fitContent()
            }

            // Update RSI Chart
            if (rsiChartRef.current) {
                if (showRSI) {
                    rsiSeriesRef.current.setData(calculateRSI(data.candles, 14))
                    rsiContainerRef.current?.classList.remove('hidden')
                    rsiChartRef.current.timeScale().fitContent()
                } else {
                    rsiContainerRef.current?.classList.add('hidden')
                }
            }
        }
      } catch (err) {
        console.error("Chart fetch error", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [symbol, interval, range, showSMA, showEMA, showRSI, showVolume])

  // Helper to handle Timeframe Click
  const handleTimeframe = (lbl: string, val: string, rng: string) => {
      setActiveLabel(lbl)
      setIntervalState(val)
      setRange(rng)
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-2">
        
        {/* Symbol & Legend */}
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
                        {legendData.rsi && <span className="text-purple-500 ml-2">RSI: {legendData.rsi.toFixed(2)}</span>}
                    </>
                ) : <span className="text-slate-400 italic">Hover for values</span>}
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe Buttons */}
            <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
                {INTERVALS.map((int) => (
                    <button
                        key={int.label}
                        onClick={() => handleTimeframe(int.label, int.value, int.range)}
                        className={`px-2 py-1 text-[10px] font-bold rounded uppercase transition-colors
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
            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3">
                <button onClick={() => setShowSMA(!showSMA)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showSMA ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>SMA</button>
                <button onClick={() => setShowEMA(!showEMA)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showEMA ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>EMA</button>
                <button onClick={() => setShowVolume(!showVolume)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showVolume ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>VOL</button>
                <button onClick={() => setShowRSI(!showRSI)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showRSI ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>RSI</button>
            </div>
        </div>
      </div>

      {/* CHARTS CONTAINER */}
      <div className="relative flex-1 w-full bg-white dark:bg-slate-900 flex flex-col">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
            <span className="text-xs text-slate-500 font-medium animate-pulse">Loading market data...</span>
          </div>
        )}
        
        {/* Main Price Chart */}
        <div ref={mainContainerRef} className="w-full flex-1 min-h-[350px]" />
        
        {/* RSI Chart (Conditional Render via CSS to keep instance alive) */}
        <div 
            ref={rsiContainerRef} 
            className={`w-full h-[150px] border-t border-slate-100 dark:border-slate-800 transition-all ${!showRSI ? 'hidden' : 'block'}`} 
        />
      </div>
    </div>
  )
}

export default memo(TechnicalChart)