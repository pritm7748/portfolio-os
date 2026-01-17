import { Transaction } from '@/hooks/use-portfolio-data'

export type TaxLot = {
    ticker: string
    buyDate: string
    quantity: number
    buyPrice: number
    currentPrice: number
    unrealizedPnL: number
    type: 'ST' | 'LT' // Short Term or Long Term potential
    daysHeld: number
}

export type TaxReport = {
    realized: {
        stcg: number
        ltcg: number
        stcl: number
        ltcl: number
        netShortTerm: number
        netLongTerm: number
    }
    opportunities: {
        stcl: TaxLot[] // Assets you can sell to book Short Term Loss
        ltcl: TaxLot[] // Assets you can sell to book Long Term Loss
    }
}

// Configuration (Defaults for Indian Equity)
const LT_THRESHOLD_DAYS = 365 
const FY_START_MONTH = 3 // April (0-indexed = 3)

export function calculateTaxHarvesting(
    transactions: Transaction[], 
    prices: Record<string, any> // prices might be undefined initially
): TaxReport {
    
    // 1. Determine Current Financial Year Start
    const today = new Date()
    const currentYear = today.getFullYear()
    // If today is Jan-Mar, FY started prev year April. Else current year April.
    const fyStartYear = today.getMonth() < FY_START_MONTH ? currentYear - 1 : currentYear
    const fyStartDate = new Date(fyStartYear, FY_START_MONTH, 1)

    // 2. FIFO Engine State
    const holdings: Record<string, { date: Date, price: number, qty: number }[]> = {}
    
    const report: TaxReport = {
        realized: { stcg: 0, ltcg: 0, stcl: 0, ltcl: 0, netShortTerm: 0, netLongTerm: 0 },
        opportunities: { stcl: [], ltcl: [] }
    }

    if (!transactions) return report

    // 3. Process Transactions Chronologically
    const sortedTxns = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    sortedTxns.forEach(t => {
        const ticker = t.assets.ticker
        const date = new Date(t.date)
        const qty = Number(t.quantity)
        const price = Number(t.price)

        if (!holdings[ticker]) holdings[ticker] = []

        if (t.transaction_type === 'Buy') {
            holdings[ticker].push({ date, price, qty })
        } 
        else if (t.transaction_type === 'Sell') {
            let qtyToSell = qty
            
            while (qtyToSell > 0 && holdings[ticker].length > 0) {
                const lot = holdings[ticker][0] // FIFO: Take oldest
                const takeQty = Math.min(lot.qty, qtyToSell)
                
                // Calculate P&L for this chunk
                const pnl = (price - lot.price) * takeQty
                
                // Check if this sale happened in THIS Financial Year
                if (date >= fyStartDate) {
                    const diffTime = Math.abs(date.getTime() - lot.date.getTime())
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                    const isLongTerm = diffDays > LT_THRESHOLD_DAYS

                    if (isLongTerm) {
                        if (pnl >= 0) report.realized.ltcg += pnl
                        else report.realized.ltcl += Math.abs(pnl)
                    } else {
                        if (pnl >= 0) report.realized.stcg += pnl
                        else report.realized.stcl += Math.abs(pnl)
                    }
                }

                // Update Lot
                if (lot.qty > takeQty) {
                    lot.qty -= takeQty
                    qtyToSell = 0
                } else {
                    qtyToSell -= lot.qty
                    holdings[ticker].shift() // Remove exhausted lot
                }
            }
        }
    })

    // 4. Calculate Net Realized
    report.realized.netShortTerm = report.realized.stcg - report.realized.stcl
    report.realized.netLongTerm = report.realized.ltcg - report.realized.ltcl

    // 5. Scan Remaining Holdings for Harvesting Opportunities
    if (prices) {
        Object.keys(holdings).forEach(ticker => {
            // Flexible price lookup
            let currentPrice = prices[ticker]?.price
            if (!currentPrice) {
                // Try finding root symbol if .NS/.BO mismatch
                const root = ticker.split('.')[0]
                const key = Object.keys(prices).find(k => k.startsWith(root))
                if (key) currentPrice = prices[key]?.price
            }
            
            if (!currentPrice) return

            holdings[ticker].forEach(lot => {
                const unrealized = (currentPrice - lot.price) * lot.qty
                
                // We only care about LOSSES for harvesting
                if (unrealized < 0) {
                    const diffTime = Math.abs(today.getTime() - lot.date.getTime())
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                    const isLongTerm = diffDays > LT_THRESHOLD_DAYS

                    const opportunity: TaxLot = {
                        ticker,
                        buyDate: lot.date.toISOString().split('T')[0],
                        quantity: lot.qty,
                        buyPrice: lot.price,
                        currentPrice,
                        unrealizedPnL: unrealized, // Negative value
                        type: isLongTerm ? 'LT' : 'ST',
                        daysHeld: diffDays
                    }

                    if (isLongTerm) report.opportunities.ltcl.push(opportunity)
                    else report.opportunities.stcl.push(opportunity)
                }
            })
        })
    }

    // Sort opportunities by largest loss first
    report.opportunities.stcl.sort((a, b) => a.unrealizedPnL - b.unrealizedPnL)
    report.opportunities.ltcl.sort((a, b) => a.unrealizedPnL - b.unrealizedPnL)

    return report
}