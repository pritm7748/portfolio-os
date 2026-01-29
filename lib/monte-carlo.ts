// lib/monte-carlo.ts

export type SimulationResult = {
    year: number
    percentiles: {
        p10: number // Worst case (10th percentile)
        p50: number // Median case (Most likely)
        p90: number // Best case (90th percentile)
    }
}

/**
 * Runs a Monte Carlo simulation using Geometric Brownian Motion.
 * @param currentValue Current Portfolio Value
 * @param annualMeanReturn Expected Annual Return (decimal, e.g., 0.12 for 12%)
 * @param annualVolatility Annualized Volatility/StdDev (decimal, e.g., 0.15 for 15%)
 * @param years Duration to simulate
 * @param simulations Number of paths to run (default 1000)
 */
export function runMonteCarlo(
    currentValue: number,
    annualMeanReturn: number,
    annualVolatility: number,
    years: number = 10,
    simulations: number = 1000
): SimulationResult[] {
    const results: number[][] = []

    // 1. Run Simulations
    for (let sim = 0; sim < simulations; sim++) {
        const path: number[] = [currentValue]
        for (let t = 1; t <= years; t++) {
            // Geometric Brownian Motion Formula:
            // S(t) = S(t-1) * exp( (mu - 0.5 * sigma^2) + sigma * Z )
            
            // Box-Muller transform for random normal distribution (Z)
            const u1 = Math.random()
            const u2 = Math.random()
            const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)

            const drift = annualMeanReturn - 0.5 * Math.pow(annualVolatility, 2)
            const shock = annualVolatility * z
            
            const nextValue = path[path.length - 1] * Math.exp(drift + shock)
            path.push(nextValue)
        }
        results.push(path)
    }

    // 2. Aggregate Percentiles per Year
    const aggregated: SimulationResult[] = []
    const currentYear = new Date().getFullYear()
    
    for (let t = 0; t <= years; t++) {
        // Extract all values for year 't' across all simulations
        const yearValues = results.map(r => r[t]).sort((a, b) => a - b)
        
        aggregated.push({
            year: currentYear + t,
            percentiles: {
                p10: yearValues[Math.floor(simulations * 0.1)],
                p50: yearValues[Math.floor(simulations * 0.5)],
                p90: yearValues[Math.floor(simulations * 0.9)],
            }
        })
    }

    return aggregated
}