// lib/indicators.ts

export const calculateSMA = (data: any[], period: number) => {
    const sma = []
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            // sma.push({ time: data[i].time, value: NaN }) // Optional: Padding
            continue
        }
        let sum = 0
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close
        }
        sma.push({ time: data[i].time, value: sum / period })
    }
    return sma
}

export const calculateEMA = (data: any[], period: number) => {
    const ema = []
    const k = 2 / (period + 1)
    
    // Start with SMA for the first point
    let sum = 0
    for (let i = 0; i < period; i++) {
        sum += data[i].close
    }
    let prevEma = sum / period
    
    // Push the first EMA point (aligned at index 'period - 1')
    ema.push({ time: data[period - 1].time, value: prevEma })

    // Calculate rest
    for (let i = period; i < data.length; i++) {
        const close = data[i].close
        const newEma = (close * k) + (prevEma * (1 - k))
        ema.push({ time: data[i].time, value: newEma })
        prevEma = newEma
    }
    return ema
}

export const calculateRSI = (data: any[], period: number = 14) => {
    // RSI logic is complex for a single chart pane
    // For now, we will focus on overlays (SMA/EMA) which render on the main price chart.
    return [] 
}