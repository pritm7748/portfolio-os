// lib/xirr.ts

// 1. Calculate days between two dates
const diffInDays = (d1: Date, d2: Date) => {
  return (d1.getTime() - d2.getTime()) / (1000 * 3600 * 24);
}

// 2. The XIRR Equation
const xirrEquation = (cashFlows: { amount: number; date: Date }[], rate: number) => {
  const startDate = cashFlows[0].date;
  let sum = 0;
  for (const cf of cashFlows) {
    const days = diffInDays(cf.date, startDate);
    // Protect against negative base with negative rate
    const base = 1 + rate;
    if (base <= 0) return Infinity; // Signal invalid rate
    sum += cf.amount / Math.pow(base, days / 365);
  }
  return sum;
}

// 3. The Derivative (needed for Newton-Raphson solver)
const xirrDerivative = (cashFlows: { amount: number; date: Date }[], rate: number) => {
  const startDate = cashFlows[0].date;
  let sum = 0;
  for (const cf of cashFlows) {
    const days = diffInDays(cf.date, startDate);
    const base = 1 + rate;
    if (base <= 0) return Infinity;
    sum += (-days / 365) * cf.amount / Math.pow(base, (days / 365) + 1);
  }
  return sum;
}

// 4. The Solver - FIXED VERSION
export function calculateXIRR(transactions: { amount: number; date: string }[], currentValue: number) {
  // Validation
  if (!transactions || transactions.length === 0) return 0;
  if (currentValue < 0) return 0; // Negative portfolio value doesn't make sense
  
  // Prepare Cash Flows
  const cashFlows = transactions.map(t => ({
    amount: t.amount,
    date: new Date(t.date)
  }));

  // Add the "Terminal Value" (Current Portfolio Value) as if we sold everything today
  cashFlows.push({
    amount: currentValue,
    date: new Date()
  });

  // Sort by date
  cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Check if we have meaningful data
  const totalInvested = cashFlows
    .filter(cf => cf.amount < 0)
    .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);
  
  if (totalInvested === 0) return 0; // No investments made

  // Calculate simple return to get initial guess
  const totalReturns = cashFlows
    .filter(cf => cf.amount > 0)
    .reduce((sum, cf) => sum + cf.amount, 0);
  
  const simpleReturn = (totalReturns - totalInvested) / totalInvested;
  
  // Time span in years
  const firstDate = cashFlows[0].date;
  const lastDate = cashFlows[cashFlows.length - 1].date;
  const yearsSpan = diffInDays(lastDate, firstDate) / 365;
  
  if (yearsSpan < 0.01) return 0; // Less than ~4 days, not meaningful

  // Initial guess based on simple annualized return
  let rate = yearsSpan > 0 ? Math.pow(1 + simpleReturn, 1 / yearsSpan) - 1 : simpleReturn;
  
  // Clamp initial guess to reasonable bounds
  rate = Math.max(-0.9, Math.min(rate, 5)); // Between -90% and 500%

  // Newton-Raphson Method with better convergence
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    const fValue = xirrEquation(cashFlows, rate);
    const fDerivative = xirrDerivative(cashFlows, rate);
    
    // Check for invalid values
    if (!isFinite(fValue) || !isFinite(fDerivative)) {
      // Try a different starting point
      rate = simpleReturn / Math.max(1, yearsSpan);
      continue;
    }
    
    if (Math.abs(fDerivative) < 1e-10) {
      // Derivative too small, adjust rate slightly
      rate = rate * 0.9;
      continue;
    }

    const newRate = rate - fValue / fDerivative;
    
    // Clamp to prevent divergence (allow negative rates down to -99%)
    const clampedRate = Math.max(-0.99, Math.min(newRate, 10));
    
    // Check for convergence
    if (Math.abs(clampedRate - rate) < tolerance) {
      rate = clampedRate;
      break;
    }
    
    rate = clampedRate;
  }

  // Final validation
  if (!isFinite(rate) || isNaN(rate)) {
    // Fallback: Calculate simple annualized return
    if (yearsSpan > 0 && totalInvested > 0) {
      const finalReturn = (currentValue - totalInvested) / totalInvested;
      return finalReturn * 100 / yearsSpan; // Simple annualized
    }
    return 0;
  }

  return rate * 100; // Return as percentage (can be negative)
}