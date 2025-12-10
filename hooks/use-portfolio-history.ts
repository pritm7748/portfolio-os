import { useMemo } from 'react'

export function usePortfolioHistory(transactions: any[]) {
  return useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { equity: [], commodity: [] }
    }

    // 1. Sort transactions chronologically
    const sortedTxns = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    // 2. Determine Timeline Range
    const startDate = new Date(sortedTxns[0].date)
    const today = new Date()
    
    // 3. Initialize Tracking Variables
    // We track the "Cost Basis" (Invested Amount) separately for Equity and Commodity
    let currentEqInvested = 0
    let currentCommInvested = 0
    
    // Group transactions by date for fast lookup
    const txnMap: Record<string, any[]> = {}
    sortedTxns.forEach(t => {
        const d = new Date(t.date).toISOString().split('T')[0]
        if (!txnMap[d]) txnMap[d] = []
        txnMap[d].push(t)
    })

    const historyEquity: any[] = []
    const historyCommodity: any[] = []

    // Helper: Asset Type Check
    const getCategory = (t: any) => {
        const type = (t.assets?.asset_type || 'Stock').toLowerCase()
        const ticker = (t.assets?.ticker || '').toUpperCase()
        if (type.includes('commodity') || type.includes('gold') || type.includes('silver') || type.includes('currency') || ticker.startsWith('COMMODITY:')) {
            return 'commodity'
        }
        return 'equity'
    }

    // 4. DAY-BY-DAY REPLAY LOOP
    // We walk from the first trade date to today.
    // If no trade happened on a day, we carry forward the previous day's invested amount.
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const dayTxns = txnMap[dateStr]

        if (dayTxns) {
            // Apply all transactions for this specific date
            dayTxns.forEach(txn => {
                const amount = Number(txn.quantity) * Number(txn.price)
                const category = getCategory(txn)

                if (txn.transaction_type === 'Buy') {
                    if (category === 'commodity') currentCommInvested += amount
                    else currentEqInvested += amount
                } 
                else if (txn.transaction_type === 'Sell') {
                    // Reduce invested amount proportionally
                    // (Simplified for history chart: remove the value sold from cost basis)
                    if (category === 'commodity') currentCommInvested -= amount
                    else currentEqInvested -= amount
                }
            })
        }

        // Push Snapshot for this day
        // Note: 'value' initially tracks 'invested'. The Chart Component will scale this to Net Worth.
        historyEquity.push({ 
            date: dateStr, 
            invested: Math.max(0, currentEqInvested), 
            value: Math.max(0, currentEqInvested) 
        })
        
        historyCommodity.push({ 
            date: dateStr, 
            invested: Math.max(0, currentCommInvested), 
            value: Math.max(0, currentCommInvested) 
        })
    }

    return { equity: historyEquity, commodity: historyCommodity }

  }, [transactions])
}