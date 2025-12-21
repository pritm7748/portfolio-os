'use client'

import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, TrendingUp, BarChart2, Activity, Zap, Maximize2 } from 'lucide-react'
import { calculateSMA, calculateEMA } from '@/lib/indicators'
import { useChartData } from '@/hooks/use-portfolio-data'

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

  // Default to 15m
  const [interval, setIntervalState] = useState('15m')
  const [range, setRange] = useState('60d')
  const [activeLabel, setActiveLabel] = useState('15m')
  
  // Indicators
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  
  const [legendData, setLegendData] = useState<any>(null)

  // Data Hook
  const { data, isLoading } = useChartData(symbol, interval, range)

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    // --- CHART CONFIG ---
    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' }, // Transparent for better dark mode blending
        textColor: '#64748b',
        attributionLogo: false, 
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.15)' }, // Subtle Grid
        horzLines: { color: 'rgba(197, 203, 206, 0.15)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 450, 
      crosshair: { 
          mode: CrosshairMode.Normal,
          vertLine: { labelVisible: true },
          horzLine: { labelVisible: true }
      },
      timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(197, 203, 206, 0.3)',
        rightOffset: 12, // More space for latest candle
        barSpacing: 8,
      },
      // MAIN PRICE SCALE (Candles)
      // Restricted to Top 75% of the chart
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
        visible: true,
        scaleMargins: {
            top: 0.05,    
            bottom: 0.25 // Reserve bottom 25% for Volume
        }
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    }

    // Dark Mode Colors
    if (document.documentElement.classList.contains('dark')) {
        chartOptions.layout.textColor = '#94a3b8'
    }

    const chart = createChart(chartContainerRef.current, chartOptions)

    // --- A. VOLUME SERIES (Strict Bottom 25%) ---
    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol_scale', // Custom Scale
    })
    
    // Configure 'vol_scale' to occupy EXACTLY the bottom 25%
    chart.priceScale('vol_scale').applyOptions({
        scaleMargins: {
            top: 0.75, // Start at 75% height
            bottom: 0, // Go to 100% height
        },
        visible: false // No Y-axis labels for volume
    })
    volumeSeriesRef.current = volumeSeries

    // --- B. CANDLE SERIES (Top 75%) ---
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // --- C. INDICATORS ---
    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20', lastValueVisible: false, priceLineVisible: false })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50', lastValueVisible: false, priceLineVisible: false })
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    chartRef.current = chart

    // --- LEGEND & TOUCH LOGIC ---
    chart.subscribeCrosshairMove((param) => {
        if (param.time) {
            const data: any = {}
            const candle = param.seriesData.get(candleSeries) as any
            if (candle) {
                data.open = candle.open; data.high = candle.high; 
                data.low = candle.low; data.close = candle.close;
                // Format: "12 Oct, 14:30"
                const dateObj = new Date(Number(param.time) * 1000)
                data.date = dateObj.toLocaleDateString(undefined, {day:'numeric', month:'short'}) + ', ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
            }
            setLegendData(data)
        } else {
            setLegendData(null)
        }
    })

    // Resize Observer (Optimized)
    const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0 || !entries[0].contentRect) return
        if (chartRef.current) {
            chartRef.current.applyOptions({ width: entries[0].contentRect.width })
        }
    })
    resizeObserver.observe(chartContainerRef.current)

    return () => {
        resizeObserver.disconnect()
        chart.remove()
    }
  }, [])

  // 2. Data Logic
  useEffect(() => {
    if (data?.candles && data.candles.length > 0 && chartRef.current) {
        
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

        // Smart Zoom: Show last 80 candles
        const total = data.candles.length
        if (total > 80) {
            chartRef.current.timeScale().setVisibleLogicalRange({ from: total - 80, to: total })
        } else {
            chartRef.current.timeScale().fitContent()
        }
    }
  }, [data, showSMA, showEMA, showVolume])

  const handleTimeframe = useCallback((lbl: string, val: string, rng: string) => {
      setActiveLabel(lbl)
      setIntervalState(val)
      setRange(rng)
  }, [])

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
      
      {/* --- HEADER: SYMBOL & LEGEND ONLY --- */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col">
            <div className="flex items-baseline justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{symbol}</h3>
                {legendData && <span className="text-xs font-mono text-slate-500">{legendData.date}</span>}
            </div>
            
            {/* Responsive OHLC Legend - Won't overlap controls because controls are moved to footer */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono mt-1 text-slate-600 dark:text-slate-400">
                {legendData ? (
                    <>
                        <span>O:<span className="text-slate-900 dark:text-white">{legendData.open}</span></span>
                        <span>H:<span className="text-slate-900 dark:text-white">{legendData.high}</span></span>
                        <span>L:<span className="text-slate-900 dark:text-white">{legendData.low}</span></span>
                        <span>C:<span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.close}</span></span>
                    </>
                ) : <span className="italic opacity-50">Hover/Drag chart to view history</span>}
            </div>
        </div>
      </div>

      {/* --- CHART CANVAS --- */}
      <div className="relative w-full h-[400px] md:h-[500px] bg-white dark:bg-slate-900 touch-none">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
            <span className="text-xs text-slate-500 font-medium animate-pulse">Loading market data...</span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full cursor-crosshair" />
      </div>

      {/* --- FOOTER TOOLBAR (Separated for Mobile UX) --- */}
      <div className="flex flex-col md:flex-row items-center justify-between p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-2">
        
        {/* Timeframe Selector (Scrollable) */}
        <div className="w-full md:w-auto overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 p-1">
                {INTERVALS.map((int) => (
                    <button
                        key={int.label}
                        onClick={() => handleTimeframe(int.label, int.value, int.range)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap min-w-[40px]
                            ${activeLabel === int.label
                            ? "bg-indigo-600 text-white shadow-sm" 
                            : "bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            }`}
                    >
                    {int.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end px-1">
            <button onClick={() => setShowSMA(!showSMA)} className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${showSMA ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}>SMA</button>
            <button onClick={() => setShowEMA(!showEMA)} className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${showEMA ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}>EMA</button>
            <button onClick={() => setShowVolume(!showVolume)} className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${showVolume ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}>VOL</button>
        </div>
      </div>

    </div>
  )
}

export default memo(TechnicalChart)