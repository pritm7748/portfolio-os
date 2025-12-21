'use client'

import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, Activity, BarChart2 } from 'lucide-react'
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

  // State
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

  // 1. Initialize Chart (Strictly Logic - No UI Changes here)
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(197, 203, 206, 0.3)',
        rightOffset: 12,
        barSpacing: 6,
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
        visible: true,
        scaleMargins: {
            top: 0.1,    
            bottom: 0.25 // Reserve bottom 25% for Volume
        }
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    }

    if (document.documentElement.classList.contains('dark')) {
        chartOptions.layout.textColor = '#94a3b8'
    }

    const chart = createChart(chartContainerRef.current, chartOptions)

    // A. VOLUME (Scale Margins: Top 80% empty, Bottom 20% filled)
    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol_scale',
    })
    chart.priceScale('vol_scale').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        visible: false 
    })
    volumeSeriesRef.current = volumeSeries

    // B. CANDLES
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // C. INDICATORS
    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20', lastValueVisible: false, priceLineVisible: false })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50', lastValueVisible: false, priceLineVisible: false })
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    chartRef.current = chart

    // --- LEGEND LOGIC (OHLCV) ---
    chart.subscribeCrosshairMove((param) => {
        if (param.time) {
            const data: any = {}
            const candle = param.seriesData.get(candleSeries) as any
            const volume = param.seriesData.get(volumeSeries) as any
            
            if (candle) {
                data.open = candle.open; data.high = candle.high; 
                data.low = candle.low; data.close = candle.close;
                data.isUp = candle.close >= candle.open; // Trend Direction
                
                const dateObj = new Date(Number(param.time) * 1000)
                data.date = dateObj.toLocaleDateString(undefined, {day:'numeric', month:'short'}) + ', ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
            }
            
            if (volume) {
                data.volume = volume.value
            }

            setLegendData(data)
        } else {
            setLegendData(null)
        }
    })

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

        // Zoom to last 80 candles
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

  // Helper to format Volume (e.g., 1.5M, 200k)
  const formatVol = (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
      if (num >= 1000) return (num / 1000).toFixed(2) + 'k'
      return num.toString()
  }

  // Helper for dynamic colors
  const valColor = (isUp: boolean) => isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
      
      {/* 1. TOP HEADER: Symbol & OHLCV Legend */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 min-h-[60px] flex flex-col justify-center">
        <div className="flex flex-col">
            <div className="flex items-baseline justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{symbol}</h3>
                {legendData && <span className="text-xs font-mono text-slate-500">{legendData.date}</span>}
            </div>
            
            {/* OHLCV Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs font-mono mt-1 text-slate-600 dark:text-slate-400">
                {legendData ? (
                    <>
                        <span>O:<span className={valColor(legendData.isUp)}>{legendData.open}</span></span>
                        <span>H:<span className={valColor(legendData.isUp)}>{legendData.high}</span></span>
                        <span>L:<span className={valColor(legendData.isUp)}>{legendData.low}</span></span>
                        <span>C:<span className={valColor(legendData.isUp)}>{legendData.close}</span></span>
                        {legendData.volume && <span>V:<span className="text-slate-900 dark:text-white">{formatVol(legendData.volume)}</span></span>}
                    </>
                ) : <span className="italic opacity-50">Hover/Drag chart to view history</span>}
            </div>
        </div>
      </div>

      {/* 2. CHART CANVAS */}
      <div className="relative w-full h-[450px] bg-white dark:bg-slate-900 touch-none">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
            <span className="text-xs text-slate-500 font-medium animate-pulse">Loading market data...</span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full cursor-crosshair" />
      </div>

      {/* 3. DESKTOP CONTROLS (Hidden on Mobile) */}
      <div className="hidden md:flex items-center justify-between p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex gap-1">
            {INTERVALS.map((int) => (
                <button
                    key={int.label}
                    onClick={() => handleTimeframe(int.label, int.value, int.range)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-colors
                        ${activeLabel === int.label ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                >
                {int.label}
                </button>
            ))}
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowSMA(!showSMA)} className={`px-2 py-1 text-xs font-bold rounded border ${showSMA ? 'bg-blue-50 border-blue-200 text-blue-600' : 'text-slate-400 border-slate-200'}`}>SMA</button>
            <button onClick={() => setShowEMA(!showEMA)} className={`px-2 py-1 text-xs font-bold rounded border ${showEMA ? 'bg-amber-50 border-amber-200 text-amber-600' : 'text-slate-400 border-slate-200'}`}>EMA</button>
            <button onClick={() => setShowVolume(!showVolume)} className={`px-2 py-1 text-xs font-bold rounded border ${showVolume ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'text-slate-400 border-slate-200'}`}>VOL</button>
        </div>
      </div>

      {/* 4. MOBILE CONTROLS (Bottom Toolbar - App Style) */}
      <div className="flex md:hidden items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 safe-area-pb">
        <div className="flex-1 mr-4">
            <select 
                value={activeLabel} 
                onChange={(e) => {
                    const found = INTERVALS.find(i => i.label === e.target.value)
                    if(found) handleTimeframe(found.label, found.value, found.range)
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg p-2.5 outline-none font-medium"
            >
                {INTERVALS.map(int => (
                    <option key={int.label} value={int.label}>{int.label}</option>
                ))}
            </select>
        </div>
        
        <div className="flex gap-2">
            <button onClick={() => setShowSMA(!showSMA)} className={`p-2.5 rounded-lg border ${showSMA ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}><Activity className="h-4 w-4"/></button>
            <button onClick={() => setShowEMA(!showEMA)} className={`p-2.5 rounded-lg border ${showEMA ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}><Activity className="h-4 w-4"/></button>
            <button onClick={() => setShowVolume(!showVolume)} className={`p-2.5 rounded-lg border ${showVolume ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}><BarChart2 className="h-4 w-4"/></button>
        </div>
      </div>

    </div>
  )
}

export default memo(TechnicalChart)