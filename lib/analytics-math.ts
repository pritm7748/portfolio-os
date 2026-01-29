// lib/analytics-math.ts

// --- TYPES ---
export type TimeSeries = { date: string; value: number }[]
export type AssetHistory = Record<string, TimeSeries>

// --- HELPERS ---
const mean = (data: number[]) => data.reduce((a, b) => a + b, 0) / data.length

const variance = (data: number[], avg: number) => 
    data.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (data.length - 1)

export const stdDev = (data: number[]) => Math.sqrt(variance(data, mean(data)))

const covariance = (dataA: number[], dataB: number[], avgA: number, avgB: number) => {
    let sum = 0
    for (let i = 0; i < dataA.length; i++) {
        sum += (dataA[i] - avgA) * (dataB[i] - avgB)
    }
    return sum / (dataA.length - 1)
}

// Get Daily Returns array from price history
export const getReturns = (data: TimeSeries) => {
    const returns: number[] = []
    for (let i = 1; i < data.length; i++) {
        const prev = data[i-1].value
        const curr = data[i].value
        if (prev > 0) returns.push((curr - prev) / prev)
        else returns.push(0)
    }
    return returns
}

// --- CORE METRICS ---

// 1. BETA (Volatility relative to Benchmark)
// Beta = Covariance(Portfolio, Benchmark) / Variance(Benchmark)
export function calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]) {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length === 0) return 1
    const muP = mean(portfolioReturns)
    const muB = mean(benchmarkReturns)
    const cov = covariance(portfolioReturns, benchmarkReturns, muP, muB)
    const varB = variance(benchmarkReturns, muB)
    return varB === 0 ? 1 : cov / varB
}

// 2. SHARPE RATIO (Risk-Adjusted Return)
// Sharpe = (Mean Return - RiskFreeRate) / StdDev
// annualized = raw * sqrt(252)
export function calculateSharpe(returns: number[], riskFreeRate = 0.06) {
    if (returns.length === 0) return 0
    const avgDailyRet = mean(returns)
    const sDev = stdDev(returns)
    const dailyRiskFree = Math.pow(1 + riskFreeRate, 1/252) - 1
    
    if (sDev === 0) return 0
    // Annualize
    return ((avgDailyRet - dailyRiskFree) / sDev) * Math.sqrt(252)
}

// 3. MAX DRAWDOWN (Maximum peak-to-trough decline)
export function calculateDrawdown(data: TimeSeries) {
    let peak = -Infinity
    let maxDrawdown = 0
    const drawdownCurve = data.map(point => {
        if (point.value > peak) peak = point.value
        const dd = (peak - point.value) / peak
        if (dd > maxDrawdown) maxDrawdown = dd
        return { date: point.date, value: -dd * 100 } // Return as negative %
    })
    return { maxDrawdown: maxDrawdown * 100, curve: drawdownCurve }
}

// 4. CORRELATION MATRIX (Pearson Correlation Coefficient)
export function calculateCorrelationMatrix(historyMap: AssetHistory, tickers: string[]) {
    // 1. Align Dates (Intersection of all tickers)
    // For simplicity in JS, we'll map returns by date key
    const returnsByDate: Record<string, Record<string, number>> = {}
    const dates = new Set<string>()

    tickers.forEach(t => {
        const series = historyMap[t]
        if (!series) return
        for (let i = 1; i < series.length; i++) {
            const date = series[i].date
            const ret = (series[i].value - series[i-1].value) / series[i-1].value
            if (!returnsByDate[date]) returnsByDate[date] = {}
            returnsByDate[date][t] = ret
            dates.add(date)
        }
    })

    const sortedDates = Array.from(dates).sort()
    const matrix: { x: string, y: string, value: number }[] = []

    // 2. Compute Pairwise Correlation
    for (let i = 0; i < tickers.length; i++) {
        for (let j = 0; j < tickers.length; j++) {
            const tA = tickers[i]
            const tB = tickers[j]
            
            // Extract aligned arrays
            const arrA: number[] = []
            const arrB: number[] = []
            
            sortedDates.forEach(d => {
                if (returnsByDate[d][tA] !== undefined && returnsByDate[d][tB] !== undefined) {
                    arrA.push(returnsByDate[d][tA])
                    arrB.push(returnsByDate[d][tB])
                }
            })

            if (arrA.length < 10) {
                matrix.push({ x: tA, y: tB, value: 0 })
                continue
            }

            const muA = mean(arrA)
            const muB = mean(arrB)
            const cov = covariance(arrA, arrB, muA, muB)
            const sigmaA = stdDev(arrA)
            const sigmaB = stdDev(arrB)
            
            const corr = (sigmaA * sigmaB) === 0 ? 0 : cov / (sigmaA * sigmaB)
            matrix.push({ x: tA, y: tB, value: corr })
        }
    }
    return matrix
}