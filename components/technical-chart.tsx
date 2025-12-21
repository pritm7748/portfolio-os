'use client'

import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
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

  const [interval, setIntervalState] = useState('15m')
  const [range, setRange] = useState('60d')
  
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
      height: 500,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(197, 203, 206, 0.3)',
        rightOffset: 6,
      },
      // MAIN SCALE (Candles): Takes up top 85%
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
        visible: true,
        scaleMargins: {
            top: 0.1,    // Leave 10% space at top
            bottom: 0.25 // Leave 25% space at bottom for volume
        }
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    }

    // Apply Dark Mode styles if needed (basic check)
    if (document.documentElement.classList.contains('dark')) {
       chartOptions.layout.textColor = '#94a3b8'
    }

    const chart = createChart(chartContainerRef.current, chartOptions)

    // --- A. VOLUME SERIES (Strictly Bottom 15%) ---
    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol_scale', // SEPARATE SCALE ID
    })
    
    // Configure the Custom Volume Scale
    chart.priceScale('vol_scale').applyOptions({
        scaleMargins: {
            top: 0.85, // Push down to bottom 15%
            bottom: 0,
        },
        visible: false // Don't show numbers
    })
    volumeSeriesRef.current = volumeSeries

    // --- B. CANDLE SERIES (Main Scale) ---
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // --- C. INDICATORS (Main Scale Overlay) ---
    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20', lastValueVisible: false, priceLineVisible: false })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50', lastValueVisible: false, priceLineVisible: false })
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    chartRef.current = chart

    // --- LEGEND LOGIC ---
    chart.subscribeCrosshairMove((param) => {
        if (param.time) {
            const data: any = {}
            const candle = param.seriesData.get(candleSeries) as any
            if (candle) {
                data.open = candle.open; data.high = candle.high; 
                data.low = candle.low; data.close = candle.close;
                const dateObj = new Date(Number(param.time) * 1000)
                data.date = dateObj.toLocaleDateString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})
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

  // 2. Data Update Logic
  useEffect(() => {
    if (data?.candles && data.candles.length > 0 && chartRef.current) {
        
        candleSeriesRef.current.setData(data.candles)
        
        // Handle Volume
        if (showVolume) {
            volumeSeriesRef.current.setData(data.volume)
            volumeSeriesRef.current.applyOptions({ visible: true })
        } else {
            volumeSeriesRef.current.applyOptions({ visible: false })
        }

        // Handle Indicators
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

        // Smart Zoom: Show last 100 bars
        const total = data.candles.length
        if (total > 80) {
            chartRef.current.timeScale().setVisibleLogicalRange({ from: total - 80, to: total })
        } else {
            chartRef.current.timeScale().fitContent()
        }
    }
  }, [data, showSMA, showEMA, showVolume])

  // Handler for Native Select Change
  const handleMobileIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value
      const found = INTERVALS.find(i => i.value === val)
      if (found) {
          setIntervalState(found.value)
          setRange(found.range)
      }
  }

  // Handler for Desktop Button Click
  const handleDesktopIntervalChange = (val: string, rng: string) => {
      setIntervalState(val)
      setRange(rng)
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* --- RESPONSIVE TOOLBAR --- */}
      <div className="flex flex-col border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        
        {/* Row 1: Symbol & Legend */}
        <div className="flex items-center justify-between px-4 py-3">
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg truncate">{symbol}</h3>
                    {legendData && <span className="text-xs font-mono text-slate-500 whitespace-nowrap">{legendData.date}</span>}
                </div>
                
                {/* Desktop Legend (Detailed) */}
                <div className="hidden md:flex items-center gap-3 text-xs font-mono mt-1 h-4 overflow-hidden truncate">
                    {legendData ? (
                        <>
                            <span className="text-slate-600 dark:text-slate-400">O:<span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.open}</span></span>
                            <span className="text-slate-600 dark:text-slate-400">H:<span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.high}</span></span>
                            <span className="text-slate-600 dark:text-slate-400">L:<span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.low}</span></span>
                            <span className="text-slate-600 dark:text-slate-400">C:<span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.close}</span></span>
                        </>
                    ) : <span className="text-slate-400 italic">Hover chart</span>}
                </div>

                {/* Mobile Legend (Simplified) */}
                <div className="md:hidden text-xs font-mono mt-1 text-slate-500 h-4">
                    {legendData ? (
                        <span>Close: <span className={legendData.open > legendData.close ? 'text-red-500' : 'text-green-500'}>{legendData.close}</span></span>
                    ) : <span>Live Data</span>}
                </div>
            </div>

            {/* Indicator Toggles (Compact) */}
            <div className="flex items-center gap-1">
                <button onClick={() => setShowSMA(!showSMA)} className={`px-2 py-1 text-[10px] font-bold rounded border ${showSMA ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>S</button>
                <button onClick={() => setShowEMA(!showEMA)} className={`px-2 py-1 text-[10px] font-bold rounded border ${showEMA ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>E</button>
                <button onClick={() => setShowVolume(!showVolume)} className={`px-2 py-1 text-[10px] font-bold rounded border ${showVolume ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>V</button>
            </div>
        </div>

        {/* Row 2: Timeframe Selector (Responsive) */}
        <div className="px-4 pb-2">
            
            {/* MOBILE: Native Select Dropdown */}
            <div className="block md:hidden">
                <select 
                    value={interval} 
                    onChange={handleMobileIntervalChange}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    {INTERVALS.map(int => (
                        <option key={int.label} value={int.value}>
                            {int.label === '1m' ? '1 Minute' : 
                             int.label === '15m' ? '15 Minutes (Default)' : 
                             int.label === '1D' ? 'Daily' : int.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* DESKTOP: Button Group */}
            <div className="hidden md:flex flex-wrap gap-1">
                {INTERVALS.map((int) => (
                    <button
                        key={int.label}
                        onClick={() => handleDesktopIntervalChange(int.value, int.range)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors
                            ${interval === int.value 
                            ? "bg-indigo-600 text-white shadow-sm" 
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                            }`}
                    >
                    {int.label}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* CHART CANVAS */}
      <div className="relative flex-1 w-full bg-white dark:bg-slate-900 min-h-[400px] md:min-h-[500px]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
            <span className="text-xs text-slate-500 font-medium animate-pulse">Loading market data...</span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full cursor-crosshair" />
      </div>
    </div>
  )
}

export default memo(TechnicalChart)