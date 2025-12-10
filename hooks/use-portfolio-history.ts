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
    let currentEqInvested = 0
    let currentCommInvested = 0
    
    // Map to quickly find transactions for a specific date
    // Key: "YYYY-MM-DD", Value: Transaction[]
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

    // 4. DAY-BY-DAY REPLAY (The Fix)
    // Loop from Start Date -> Today to create a seamless line chart
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const dayTxns = txnMap[dateStr]

        if (dayTxns) {
            // Apply all transactions that happened on this specific date
            dayTxns.forEach(txn => {
                const amount = Number(txn.quantity) * Number(txn.price)
                const category = getCategory(txn)

                if (txn.transaction_type === 'Buy') {
                    if (category === 'commodity') currentCommInvested += amount
                    else currentEqInvested += amount
                } 
                else if (txn.transaction_type === 'Sell') {
                    // Simple deduction for invested amount tracking
                    // (For precise FIFO cost-basis reduction, we'd need the full engine, 
                    // but for an "Invested vs Value" chart, subtracting the sell value is the standard approximation)
                    if (category === 'commodity') currentCommInvested -= amount
                    else currentEqInvested -= amount
                }
            })
        }

        // Record the snapshot for THIS day (Carrying forward previous values if no trade occurred)
        // Note: We clamp at 0 to avoid negative spikes from data anomalies
        historyEquity.push({ 
            date: dateStr, 
            invested: Math.max(0, currentEqInvested), 
            value: Math.max(0, currentEqInvested) // Placeholder for Value (patched by chart)
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