'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Loader2, TrendingUp, BarChart2, Activity, Zap } from 'lucide-react'
import { calculateSMA, calculateEMA, calculateRSI } from '@/lib/indicators'

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
  // Container Refs
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  
  // Chart Instance Refs
  const mainChartRef = useRef<any>(null)
  const rsiChartRef = useRef<any>(null)
  
  // Series Refs
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const smaSeriesRef = useRef<any>(null)
  const emaSeriesRef = useRef<any>(null)
  const rsiSeriesRef = useRef<any>(null)

  // State
  const [interval, setIntervalState] = useState('15m')
  const [range, setRange] = useState('60d')
  const [activeLabel, setActiveLabel] = useState('15m')
  const [loading, setLoading] = useState(true)
  
  // Indicators (Default: TRUE)
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(true)
  const [showRSI, setShowRSI] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  
  const [legendData, setLegendData] = useState<any>(null)

  // 1. Initialize Charts (Run Once)
  useEffect(() => {
    if (!mainContainerRef.current || !rsiContainerRef.current) return

    // --- COMMON STYLES ---
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

    // Dark Mode Support
    if (document.documentElement.classList.contains('dark')) {
        Object.assign(chartOptions, {
            layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            timeScale: { borderColor: '#334155' },
            rightPriceScale: { borderColor: '#334155' }
        })
    }

    // --- A. MAIN CHART ---
    const mainChart = createChart(mainContainerRef.current, {
        ...chartOptions,
        width: mainContainerRef.current.clientWidth,
        height: 400, // Fixed height for main chart
    })

    // 1. Volume (Added first to be behind candles)
    const volumeSeries = mainChart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay mode
    })
    volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 } // Push to bottom 20%
    })
    volumeSeriesRef.current = volumeSeries

    // 2. Candles
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // 3. Moving Averages
    const smaSeries = mainChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20' })
    const emaSeries = mainChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50' })
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    // --- B. RSI CHART ---
    const rsiChart = createChart(rsiContainerRef.current, {
        ...chartOptions,
        width: rsiContainerRef.current.clientWidth,
        height: 150, // Fixed height for RSI
    })
    
    // RSI Line
    const rsiSeries = rsiChart.addSeries(LineSeries, { 
        color: '#8b5cf6', 
        lineWidth: 2,
        title: 'RSI 14'
    })
    // 70/30 Levels
    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
    rsiSeries.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' })
    
    rsiSeriesRef.current = rsiSeries

    mainChartRef.current = mainChart
    rsiChartRef.current = rsiChart

    // --- SYNCHRONIZATION ---
    // Sync Scrolling
    mainChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) rsiChart.timeScale().setVisibleRange(range)
    })
    rsiChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) mainChart.timeScale().setVisibleRange(range)
    })

    // Sync Crosshair
    mainChart.subscribeCrosshairMove((param) => {
        if (param.time) {
            rsiChart.setCrosshairPosition(0, param.time, rsiSeries)
            updateLegend(param)
        } else {
            rsiChart.clearCrosshairPosition()
            setLegendData(null)
        }
    })

    rsiChart.subscribeCrosshairMove((param) => {
        if (param.time) {
            mainChart.setCrosshairPosition(0, param.time, candleSeries)
            // We can't easily get main chart data from here, so we rely on main chart hover
        } else {
            mainChart.clearCrosshairPosition()
        }
    })

    const updateLegend = (param: any) => {
        const data: any = {}
        const candle = param.seriesData.get(candleSeries) as any
        if (candle) {
            data.open = candle.open; data.high = candle.high; 
            data.low = candle.low; data.close = candle.close;
            const dateObj = new Date(Number(param.time) * 1000)
            data.date = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
        }
        if (showSMA && smaSeriesRef.current) {
            const s = param.seriesData.get(smaSeriesRef.current) as any
            if (s) data.sma = s.value
        }
        if (showEMA && emaSeriesRef.current) {
            const e = param.seriesData.get(emaSeriesRef.current) as any
            if (e) data.ema = e.value
        }
        // For RSI, we need to grab it from the RSI chart instance logic, 
        // but crosshair sync handles the visual line. 
        // For the label value, we can approximate or fetch from data array if needed.
        // Simplified: The RSI chart has its own labels visible on the scale.
        setLegendData(data)
    }

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
  }, []) // Init once

  // 2. Data Fetching & Updates
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
            
            // A. Update Main Chart
            if (mainChartRef.current) {
                candleSeriesRef.current.setData(data.candles)
                
                // Volume
                if (showVolume) {
                    volumeSeriesRef.current.setData(data.volume)
                    volumeSeriesRef.current.applyOptions({ visible: true })
                } else {
                    volumeSeriesRef.current.applyOptions({ visible: false })
                }

                // Indicators
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
                
                // CRITICAL: Fit content to make sure chart is visible!
                mainChartRef.current.timeScale().fitContent()
            }

            // B. Update RSI Chart
            if (rsiChartRef.current) {
                if (showRSI) {
                    const rsiData = calculateRSI(data.candles, 14)
                    rsiSeriesRef.current.setData(rsiData)
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

  const handleTimeframe = (lbl: string, val: string, rng: string) => {
      setActiveLabel(lbl)
      setIntervalState(val)
      setRange(rng)
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-2">
        
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

      {/* CHARTS CONTAINER (FLEX COLUMN) */}
      <div className="relative flex-1 w-full bg-white dark:bg-slate-900 flex flex-col min-h-[550px]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
            <span className="text-xs text-slate-500 font-medium animate-pulse">Loading market data...</span>
          </div>
        )}
        
        {/* Main Price Chart (Flex 1 to take remaining space) */}
        <div ref={mainContainerRef} className="w-full flex-1" />
        
        {/* RSI Chart (Fixed Height Bottom Pane) */}
        <div 
            ref={rsiContainerRef} 
            className={`w-full h-[150px] border-t border-slate-100 dark:border-slate-800 transition-all ${!showRSI ? 'hidden' : 'block'}`} 
        />
      </div>
    </div>
  )
}

export default memo(TechnicalChart)