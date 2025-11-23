// lib/xirr.ts

// 1. Calculate days between two dates
const diffInDays = (d1: Date, d2: Date) => {
  return (d1.getTime() - d2.getTime()) / (1000 * 3600 * 24);
}

// 2. The XIRR Equation
// We look for a rate 'r' such that the sum of discounted cash flows is 0.
const xirrEquation = (cashFlows: { amount: number; date: Date }[], rate: number) => {
  const startDate = cashFlows[0].date;
  let sum = 0;
  for (const cf of cashFlows) {
    const days = diffInDays(cf.date, startDate);
    sum += cf.amount / Math.pow(1 + rate, days / 365);
  }
  return sum;
}

// 3. The Derivative (needed for Newton-Raphson solver)
const xirrDerivative = (cashFlows: { amount: number; date: Date }[], rate: number) => {
  const startDate = cashFlows[0].date;
  let sum = 0;
  for (const cf of cashFlows) {
    const days = diffInDays(cf.date, startDate);
    sum += (-days / 365) * cf.amount / Math.pow(1 + rate, (days / 365) + 1);
  }
  return sum;
}

// 4. The Solver
export function calculateXIRR(transactions: { amount: number; date: string }[], currentValue: number) {
  // Prepare Cash Flows
  // Buys are NEGATIVE (Money out)
  // Sells are POSITIVE (Money in)
  // Current Value is POSITIVE (Money you would get if you sold today)
  
  const cashFlows = transactions.map(t => ({
    amount: t.amount, // Should be negative for buys, positive for sells
    date: new Date(t.date)
  }));

  // Add the "Terminal Value" (Current Portfolio Value) as if we sold everything today
  cashFlows.push({
    amount: currentValue,
    date: new Date()
  });

  // Sort by date
  cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Newton-Raphson Method
  let rate = 0.1; // Initial guess (10%)
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const fValue = xirrEquation(cashFlows, rate);
    const fDerivative = xirrDerivative(cashFlows, rate);
    
    if (Math.abs(fDerivative) < tolerance) break; // Avoid division by zero

    const newRate = rate - fValue / fDerivative;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate * 100; // Return as percentage
    }
    
    rate = newRate;
  }

  // If calculation fails or is NaN, return 0
  return isNaN(rate) ? 0 : rate * 100;
}