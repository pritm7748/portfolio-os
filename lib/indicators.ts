// lib/indicators.ts

export const calculateSMA = (data: any[], period: number) => {
    const sma = []
    // Start loop from 'period - 1' so we have enough data
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close
        }
        sma.push({ time: data[i].time, value: sum / period })
    }
    return sma
}

export const calculateEMA = (data: any[], period: number) => {
    if (data.length < period) return []
    
    const ema = []
    const k = 2 / (period + 1)
    
    // First EMA is simple average
    let sum = 0
    for (let i = 0; i < period; i++) {
        sum += data[i].close
    }
    let prevEma = sum / period
    
    // Push first point
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
    if (data.length <= period) return []

    const rsi = []
    let gains = 0
    let losses = 0

    // 1. Initial Average
    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close
        if (change > 0) gains += change
        else losses += Math.abs(change)
    }

    let avgGain = gains / period
    let avgLoss = losses / period

    // 2. Smooth calculation
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close
        let gain = change > 0 ? change : 0
        let loss = change < 0 ? Math.abs(change) : 0

        avgGain = ((avgGain * (period - 1)) + gain) / period
        avgLoss = ((avgLoss * (period - 1)) + loss) / period

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        const val = 100 - (100 / (1 + rs))
        
        rsi.push({ time: data[i].time, value: val })
    }
    
    return rsi
}