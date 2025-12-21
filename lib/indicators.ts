// lib/indicators.ts

export const calculateSMA = (data: any[], period: number) => {
    const sma = []
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push({ time: data[i].time, value: NaN }) 
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
    
    // Fill initial gap
    for(let k=0; k < period-1; k++) {
        ema.push({ time: data[k].time, value: NaN })
    }
    
    // Push the first EMA point
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
    const rsi = []
    let gains = 0
    let losses = 0

    // 1. Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close
        if (change > 0) gains += change
        else losses += Math.abs(change)
    }

    let avgGain = gains / period
    let avgLoss = losses / period

    // Fill initial gap
    for(let k=0; k < period; k++) {
        rsi.push({ time: data[k].time, value: NaN })
    }

    // 2. Smooth calculation for the rest
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close
        let gain = change > 0 ? change : 0
        let loss = change < 0 ? Math.abs(change) : 0

        avgGain = ((avgGain * (period - 1)) + gain) / period
        avgLoss = ((avgLoss * (period - 1)) + loss) / period

        const rs = avgGain / avgLoss
        const val = 100 - (100 / (1 + rs))
        
        rsi.push({ time: data[i].time, value: val })
    }
    
    return rsi
}