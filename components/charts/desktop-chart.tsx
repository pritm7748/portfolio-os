'use client'

import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Activity, BarChart2 } from 'lucide-react'
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

function DesktopChart({ symbol }: { symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  
  const candleSeriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const smaSeriesRef = useRef<any>(null)
  const emaSeriesRef = useRef<any>(null)

  const [interval, setIntervalState] = useState('15m')
  const [range, setRange] = useState('60d')
  const [activeLabel, setActiveLabel] = useState('15m')
  
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  
  const [legendData, setLegendData] = useState<any>(null)

  const { data, isLoading } = useChartData(symbol, interval, range)

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
        rightOffset: 12,
        barSpacing: 6,
        fixRightEdge: true, // <--- THE FIX FOR WHITESPACE
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
        visible: true,
        scaleMargins: {
            top: 0.05,    
            bottom: 0.25 
        }
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    }

    if (document.documentElement.classList.contains('dark')) {
        chartOptions.layout.textColor = '#94a3b8'
    }

    const chart = createChart(chartContainerRef.current, chartOptions)

    // VOLUME (Bottom 25%)
    const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol_scale',
    })
    chart.priceScale('vol_scale').applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 }, 
        visible: false 
    })
    volumeSeriesRef.current = volumeSeries

    // CANDLES
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // INDICATORS
    const smaSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, title: 'SMA 20', lastValueVisible: false, priceLineVisible: false })
    const emaSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 50', lastValueVisible: false, priceLineVisible: false })
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

  const formatVol = (num: number) => {
      if (num >= 10000000) return (num / 10000000).toFixed(2) + 'Cr'
      if (num >= 100000) return (num / 100000).toFixed(2) + 'L'
      if (num >= 1000) return (num / 1000).toFixed(2) + 'k'
      return num.toString()
  }

  const valColor = (isUp: boolean) => isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[500px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col">
            <div className="flex items-baseline gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">{symbol}</h3>
                {legendData && <span className="text-xs font-mono text-slate-500">{legendData.date}</span>}
            </div>
            <div className="flex gap-4 text-xs font-mono mt-1 text-slate-600 dark:text-slate-400">
                {legendData ? (
                    <>
                        <span>O: <span className={valColor(legendData.isUp)}>{legendData.open}</span></span>
                        <span>H: <span className={valColor(legendData.isUp)}>{legendData.high}</span></span>
                        <span>L: <span className={valColor(legendData.isUp)}>{legendData.low}</span></span>
                        <span>C: <span className={valColor(legendData.isUp)}>{legendData.close}</span></span>
                        {legendData.volume && <span>V: <span className="text-slate-900 dark:text-white">{formatVol(legendData.volume)}</span></span>}
                    </>
                ) : <span className="italic opacity-50">Hover chart</span>}
            </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                {INTERVALS.map((int) => (
                    <button
                        key={int.label}
                        onClick={() => handleTimeframe(int.label, int.value, int.range)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors
                            ${activeLabel === int.label ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:dark:text-white"}`}
                    >
                    {int.label}
                    </button>
                ))}
            </div>
            <div className="flex gap-1">
                <button onClick={() => setShowSMA(!showSMA)} className={`px-2 py-1 text-xs font-bold rounded border ${showSMA ? 'bg-blue-50 border-blue-200 text-blue-600' : 'text-slate-400 border-slate-200'}`}>SMA</button>
                <button onClick={() => setShowEMA(!showEMA)} className={`px-2 py-1 text-xs font-bold rounded border ${showEMA ? 'bg-amber-50 border-amber-200 text-amber-600' : 'text-slate-400 border-slate-200'}`}>EMA</button>
                <button onClick={() => setShowVolume(!showVolume)} className={`px-2 py-1 text-xs font-bold rounded border ${showVolume ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'text-slate-400 border-slate-200'}`}>VOL</button>
            </div>
        </div>
      </div>

      <div className="relative flex-1 w-full bg-white dark:bg-slate-900 touch-none overflow-hidden min-h-[350px]">
        <div ref={chartContainerRef} className="w-full h-full cursor-crosshair" />
      </div>
    </div>
  )
}

export default memo(DesktopChart)