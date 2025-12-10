import { useMemo } from 'react'

export function usePortfolioHistory(transactions: any[]) {
  return useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { equity: [], commodity: [] }
    }

    // 1. Sort transactions chronologically
    const sortedTxns = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    // 2. Initialize Buckets
    const historyEquity: any[] = []
    const historyCommodity: any[] = []
    
    // 3. FIFO Engine (Tracks open lots)
    const assetLots: Record<string, { price: number, quantity: number }[]> = {}
    
    // Helper to check type
    const isCommodity = (t: any) => {
        const type = t.assets?.asset_type || 'Stock'
        const ticker = t.assets?.ticker || ''
        return type === 'Commodity' || type === 'Currency' || type === 'Gold' || ticker.startsWith('COMMODITY:')
    }

    // 4. Replay History
    sortedTxns.forEach(txn => {
        const ticker = txn.assets.ticker
        
        if (!assetLots[ticker]) assetLots[ticker] = []

        // Apply Transaction
        if (txn.transaction_type === 'Buy') {
            assetLots[ticker].push({ price: Number(txn.price), quantity: Number(txn.quantity) })
        } 
        else if (txn.transaction_type === 'Sell') {
            let qtyToSell = Number(txn.quantity)
            // FIFO Logic: Sell oldest shares first
            while (qtyToSell > 0 && assetLots[ticker].length > 0) {
                if (assetLots[ticker][0].quantity > qtyToSell) {
                    assetLots[ticker][0].quantity -= qtyToSell
                    qtyToSell = 0
                } else {
                    qtyToSell -= assetLots[ticker][0].quantity
                    assetLots[ticker].shift()
                }
            }
        }

        // Calculate Totals at this specific date
        let eqInvested = 0
        let commInvested = 0

        Object.keys(assetLots).forEach(key => {
            const lots = assetLots[key]
            if (lots.length === 0) return

            // Find type from the original transaction list
            // (We need to know if "TCS" is equity or comm)
            const refTxn = transactions.find(t => t.assets.ticker === key)
            const isComm = refTxn ? isCommodity(refTxn) : false

            let val = 0
            lots.forEach(l => val += (l.quantity * l.price))

            if (isComm) commInvested += val
            else eqInvested += val
        })

        const dateStr = new Date(txn.date).toISOString()

        // Push Snapshot
        // Note: Without historical price API, 'value' tracks 'invested' historically.
        // We will patch the *final* point with the real Current Value in the chart component.
        historyEquity.push({ date: dateStr, invested: eqInvested, value: eqInvested })
        historyCommodity.push({ date: dateStr, invested: commInvested, value: commInvested })
    })

    return { equity: historyEquity, commodity: historyCommodity }

  }, [transactions])
}