'use client'

import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Activity, BarChart2, Loader2 } from 'lucide-react'
import { calculateSMA, calculateEMA } from '@/lib/indicators'
import { useChartData } from '@/hooks/use-portfolio-data'

const INTERVALS = [
  { label: '1M', value: '1m', range: '7d' },
  { label: '5M', value: '5m', range: '60d' },
  { label: '15M', value: '15m', range: '60d' },
  { label: '30M', value: '30m', range: '60d' },
  { label: '1H', value: '60m', range: '730d' },
  { label: '4H', value: '60m', range: '730d' },
  { label: '1D', value: '1d', range: '10y' },
  { label: '1W', value: '1wk', range: '10y' },
  { label: 'MO', value: '1mo', range: 'max' },
]

function MobileChart({ symbol }: { symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const smaSeriesRef = useRef<any>(null)
  const emaSeriesRef = useRef<any>(null)

  const [interval, setIntervalState] = useState('15m')
  const [range, setRange] = useState('60d')
  const [activeLabel, setActiveLabel] = useState('15M')
  
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const [legendData, setLegendData] = useState<any>(null)

  const { data, isLoading } = useChartData(symbol, interval, range)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chartOptions = {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
        crosshair: { mode: CrosshairMode.Magnet, vertLine: { labelVisible: false }, horzLine: { labelVisible: true } },
        timeScale: {
            visible: true, timeVisible: true, secondsVisible: false,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            rightOffset: 2,
            fixRightEdge: true, // Fix whitespace
            fixLeftEdge: true,
        },
        rightPriceScale: {
            visible: true,
            scaleMargins: { top: 0.05, bottom: 0.25 }
        },
        handleScale: { pinch: true, axisPressedMouseMove: true },
        handleScroll: { horzTouchDrag: true, vertTouchDrag: false, pressedMouseMove: true },
        kineticScroll: { touch: true, mouse: true }
    }

    const chart = createChart(chartContainerRef.current, chartOptions)

    const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'vol_scale',
    })
    chart.priceScale('vol_scale').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 }, visible: false 
    })
    volumeSeriesRef.current = volumeSeries

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, lastValueVisible: false, priceLineVisible: false })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, lastValueVisible: false, priceLineVisible: false })
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    chartRef.current = chart

    chart.subscribeCrosshairMove((param) => {
        if (param.time) {
            const data: any = {}
            const candle = param.seriesData.get(candleSeries) as any
            const volume = param.seriesData.get(volumeSeries) as any
            
            if (candle) {
                data.open = candle.open; data.high = candle.high; 
                data.low = candle.low; data.close = candle.close;
                data.isUp = candle.close >= candle.open;
                const dateObj = new Date(Number(param.time) * 1000)
                data.date = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })
            }
            if (volume) data.volume = volume.value
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

  useEffect(() => {
    if (data?.candles && data.candles.length > 0 && chartRef.current) {
        candleSeriesRef.current.setData(data.candles)
        
        if (showVolume) {
            volumeSeriesRef.current.setData(data.volume.map((v: any) => ({
                ...v, color: v.color || (v.close >= v.open ? '#26a69a' : '#ef5350')
            })))
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

        const total = data.candles.length
        if (total > 60) {
            chartRef.current.timeScale().setVisibleLogicalRange({ from: total - 60, to: total })
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

  const formatVol = (num: number) => {
      if (num >= 10000000) return (num / 10000000).toFixed(2) + 'Cr'
      if (num >= 100000) return (num / 100000).toFixed(2) + 'L'
      if (num >= 1000) return (num / 1000).toFixed(2) + 'k'
      return num.toString()
  }

  const valColor = (isUp: boolean) => isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[550px]">
      
      {/* HEADER: Symbol + Legend */}
      <div className="flex flex-col px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
         <div className="flex justify-between items-baseline mb-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">{symbol}</h3>
            {legendData && <span className="text-[10px] font-mono text-slate-500">{legendData.date}</span>}
         </div>
         <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-slate-600 dark:text-slate-400">
            {legendData ? (
                <>
                    <span>O:<span className={valColor(legendData.isUp)}>{legendData.open}</span></span>
                    <span>H:<span className={valColor(legendData.isUp)}>{legendData.high}</span></span>
                    <span>L:<span className={valColor(legendData.isUp)}>{legendData.low}</span></span>
                    <span>C:<span className={valColor(legendData.isUp)}>{legendData.close}</span></span>
                    {legendData.volume && <span>V: <span className="text-slate-900 dark:text-white">{formatVol(legendData.volume)}</span></span>}
                </>
            ) : <span>Long-press for details</span>}
         </div>
      </div>

      {/* CHART CANVAS */}
      <div className="relative flex-1 w-full bg-white dark:bg-slate-900 touch-pan-x touch-pan-y overflow-hidden min-h-[350px]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full cursor-crosshair" />
      </div>

      {/* BOTTOM TOOLBAR (Mobile Only) */}
      <div className="flex flex-col p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 safe-area-pb">
        
        {/* Timeframes Row (Scrollable) */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 mb-2 border-b border-slate-50 dark:border-slate-800">
            {INTERVALS.map((int) => (
                <button
                    key={int.label}
                    onClick={() => handleTimeframe(int.label, int.value, int.range)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-full whitespace-nowrap transition-colors border
                        ${activeLabel === int.label ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"}`}
                >
                {int.label}
                </button>
            ))}
        </div>

        {/* Indicators Row */}
        <div className="flex justify-between items-center px-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Indicators</span>
            <div className="flex gap-3">
                <button onClick={() => setShowSMA(!showSMA)} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold shadow-sm ${showSMA ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}>SMA</button>
                <button onClick={() => setShowEMA(!showEMA)} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold shadow-sm ${showEMA ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}>EMA</button>
                <button onClick={() => setShowVolume(!showVolume)} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold shadow-sm ${showVolume ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}>VOL</button>
            </div>
        </div>
      </div>

    </div>
  )
}

export default memo(MobileChart)