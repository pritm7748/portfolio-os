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
    // Protect against division by zero or complex numbers if rate <= -1
    const denominator = Math.pow(1 + rate, days / 365);
    sum += cf.amount / (denominator === 0 ? 0.0000001 : denominator);
  }
  return sum;
}

// 3. The Derivative
const xirrDerivative = (cashFlows: { amount: number; date: Date }[], rate: number) => {
  const startDate = cashFlows[0].date;
  let sum = 0;
  for (const cf of cashFlows) {
    const days = diffInDays(cf.date, startDate);
    sum += (-days / 365) * cf.amount / Math.pow(1 + rate, (days / 365) + 1);
  }
  return sum;
}

// 4. The Solver (Robust Version)
export function calculateXIRR(transactions: { amount: number; date: string }[], currentValue: number) {
  // --- PREP ---
  const cashFlows = transactions.map(t => ({
    amount: t.amount,
    date: new Date(t.date)
  }));

  // Add Terminal Value
  cashFlows.push({
    amount: currentValue,
    date: new Date()
  });

  // Sort by date
  cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // --- EDGE CASE: Total Loss ---
  // If current value is 0 and we have invested money, it's a -100% return.
  if (currentValue === 0) {
      return -100;
  }

  // --- SOLVER ---
  // We define a local solve function to try multiple guesses
  const solve = (guess: number): number | null => {
      let rate = guess;
      const maxIterations = 100;
      const tolerance = 1e-6;

      for (let i = 0; i < maxIterations; i++) {
          // Clamp rate to prevent Math.pow errors (rate cannot be <= -1)
          if (rate <= -1) rate = -0.9999; 

          const fValue = xirrEquation(cashFlows, rate);
          
          // Check if we found the root
          if (Math.abs(fValue) < tolerance) return rate;

          const fDerivative = xirrDerivative(cashFlows, rate);

          // Avoid division by zero
          if (Math.abs(fDerivative) < tolerance) break; 

          const newRate = rate - fValue / fDerivative;

          // Convergence check
          if (Math.abs(newRate - rate) < tolerance) return newRate;

          rate = newRate;
      }
      return null; // Failed to converge
  }

  // --- STRATEGY: Try Multiple Guesses ---
  // 1. Try 10% (Standard)
  // 2. Try -10% (For loss-making portfolios)
  // 3. Try -50% (For heavy losses)
  const guesses = [0.1, -0.1, -0.5, 0.5];

  for (const guess of guesses) {
      const result = solve(guess);
      if (result !== null && !isNaN(result) && isFinite(result)) {
          return result * 100;
      }
  }

  // If all failed, return 0 (or you could calculate simple ROI as fallback)
  return 0;
}