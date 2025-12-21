'use client'

import { useEffect, useRef, memo } from 'react'

type Props = {
    symbol: string
}

function TechnicalChart({ symbol }: Props) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    // 1. Clean up previous script if any (to prevent duplicates on symbol change)
    container.current.innerHTML = ''

    // 2. Resolve Symbol to TradingView Format
    // Yahoo uses '.NS' / '.BO', TradingView uses 'NSE:' / 'BSE:'
    let tvSymbol = symbol.toUpperCase()
    
    if (tvSymbol === 'NIFTY 50' || tvSymbol === '^NSEI') tvSymbol = 'NSE:NIFTY'
    else if (tvSymbol === 'SENSEX' || tvSymbol === '^BSESN') tvSymbol = 'BSE:SENSEX'
    else if (tvSymbol === 'BANKNIFTY' || tvSymbol === '^NSEBANK') tvSymbol = 'NSE:BANKNIFTY'
    else if (tvSymbol.endsWith('.NS')) tvSymbol = `NSE:${tvSymbol.replace('.NS', '')}`
    else if (tvSymbol.endsWith('.BO')) tvSymbol = `BSE:${tvSymbol.replace('.BO', '')}`
    else if (!tvSymbol.includes(':')) tvSymbol = `NSE:${tvSymbol}` // Default to NSE

    // 3. Inject TradingView Widget Script
    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
    script.type = "text/javascript"
    script.async = true
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": tvSymbol,
      "interval": "15", // Default to 15m
      "timezone": "Asia/Kolkata",
      "theme": document.documentElement.classList.contains('dark') ? "dark" : "light",
      "style": "1", // 1 = Candles
      "locale": "en",
      "enable_publishing": false,
      "withdateranges": true,
      "hide_side_toolbar": false,
      "allow_symbol_change": false, // We control symbol via our own dropdown
      "details": true, // Show OHLC header
      "calendar": false,
      "studies": [
        "Volume@tv-basicstudies", // Volume (Fixed!)
        "MASimple@tv-basicstudies", // SMA 
        "MAExp@tv-basicstudies", // EMA
        "RSI@tv-basicstudies" // RSI (Separate pane!)
      ],
      "support_host": "https://www.tradingview.com"
    })

    container.current.appendChild(script)

  }, [symbol])

  return (
    <div 
        className="w-full h-[600px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm" 
        ref={container} 
    />
  )
}

// Memoize to prevent re-renders unless symbol changes
export default memo(TechnicalChart)