import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { tickers, transactions } = await request.json()

        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return NextResponse.json({ error: 'No tickers' }, { status: 400 })
        }

        const getRoot = (t: string) => t.toUpperCase().replace('.NS', '').replace('.BO', '')

        // Step 1: Fetch monthly close prices for each ticker (3y of monthly data)
        const fetchMonthlyPrices = async (symbol: string) => {
            let yahooTicker = symbol.toUpperCase().replace(/\s/g, '')
            let isCommodity = false
            let commodityType = ''

            if (yahooTicker.startsWith('COMMODITY:')) {
                isCommodity = true
                if (yahooTicker.includes('GOLD')) { yahooTicker = 'GC=F'; commodityType = 'GOLD' }
                else if (yahooTicker.includes('SILVER')) { yahooTicker = 'SI=F'; commodityType = 'SILVER' }
            } else {
                if (!yahooTicker.startsWith('^') && !yahooTicker.includes('.')) yahooTicker += '.NS'
            }

            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=3y&interval=1mo`
                const res = await fetch(url, { next: { revalidate: 3600 } })
                const data = await res.json()
                const result = data?.chart?.result?.[0]
                if (!result) return null

                const timestamps = result.timestamp || []
                const closes = result.indicators?.quote?.[0]?.close || []

                // Build monthly price map: "YYYY-MM" → close price
                const monthlyPrices: Record<string, number> = {}
                timestamps.forEach((t: number, i: number) => {
                    if (closes[i] != null) {
                        const d = new Date(t * 1000)
                        const key = `${d.getFullYear()}-${d.getMonth()}`
                        monthlyPrices[key] = closes[i]
                    }
                })

                // Handle commodity conversion (USD → INR, oz → grams)
                if (isCommodity) {
                    const usdRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/INR=X?range=3y&interval=1mo`)
                    const usdData = await usdRes.json()
                    const usdResult = usdData?.chart?.result?.[0]
                    if (usdResult) {
                        const usdTs = usdResult.timestamp || []
                        const usdCloses = usdResult.indicators?.quote?.[0]?.close || []
                        const usdMap: Record<string, number> = {}
                        usdTs.forEach((t: number, i: number) => {
                            if (usdCloses[i]) {
                                const d = new Date(t * 1000)
                                usdMap[`${d.getFullYear()}-${d.getMonth()}`] = usdCloses[i]
                            }
                        })

                        const OUNCE_TO_GRAM = 31.1035
                        const PREMIUM = 1.0625
                        Object.keys(monthlyPrices).forEach(key => {
                            const rate = usdMap[key] || 84
                            if (commodityType === 'GOLD') {
                                monthlyPrices[key] = (monthlyPrices[key] * rate / OUNCE_TO_GRAM) * 10 * PREMIUM
                            } else if (commodityType === 'SILVER') {
                                monthlyPrices[key] = (monthlyPrices[key] * rate / OUNCE_TO_GRAM) * 1000 * PREMIUM
                            }
                        })
                    }
                }

                return { ticker: symbol, root: getRoot(symbol), prices: monthlyPrices }
            } catch (e) {
                return null
            }
        }

        // Fetch all prices in parallel
        const priceResults = await Promise.all(tickers.map(fetchMonthlyPrices))
        const priceByRoot: Record<string, Record<string, number>> = {}
        priceResults.forEach(r => {
            if (r) priceByRoot[r.root] = r.prices
        })

        // Step 2: For each month-end, compute holdings via FIFO replay
        const sortedTxns = [...transactions]
            .filter((t: any) => t.transaction_type === 'Buy' || t.transaction_type === 'Sell')
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

        if (sortedTxns.length === 0) {
            return NextResponse.json({ matrix: [] })
        }

        const firstDate = new Date(sortedTxns[0].date)
        const now = new Date()
        const startYear = firstDate.getFullYear()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth()

        // Build monthly portfolio values — EXCLUDE current month (incomplete Yahoo data)
        const monthlyPortfolioValue: Record<string, number> = {}
        // Only compute up to LAST completed month
        const lastCompleteMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const lastCompleteYear = currentMonth === 0 ? currentYear - 1 : currentYear

        for (let y = Math.max(startYear, currentYear - 2); y <= lastCompleteYear; y++) {
            const maxMonth = y === lastCompleteYear ? lastCompleteMonth : 11
            const startMonth = y === startYear ? firstDate.getMonth() : 0

            for (let m = startMonth; m <= maxMonth; m++) {
                const monthEnd = new Date(y, m + 1, 0)
                const key = `${y}-${m}`

                // Replay FIFO to get holdings at this month-end
                const lots: Record<string, { qty: number, cost: number }[]> = {}

                sortedTxns.forEach((txn: any) => {
                    const txnDate = new Date(txn.date)
                    if (txnDate > monthEnd) return

                    const root = getRoot(txn.ticker || txn.assets?.ticker || '')
                    if (!lots[root]) lots[root] = []

                    if (txn.transaction_type === 'Buy') {
                        lots[root].push({ qty: Number(txn.quantity), cost: Number(txn.price) })
                    } else if (txn.transaction_type === 'Sell') {
                        let qtyToSell = Number(txn.quantity)
                        while (qtyToSell > 0 && lots[root].length > 0) {
                            if (lots[root][0].qty > qtyToSell) {
                                lots[root][0].qty -= qtyToSell
                                qtyToSell = 0
                            } else {
                                qtyToSell -= lots[root][0].qty
                                lots[root].shift()
                            }
                        }
                    }
                })

                // Calculate portfolio value using market prices
                let totalValue = 0
                Object.entries(lots).forEach(([root, stockLots]) => {
                    const totalQty = stockLots.reduce((s, l) => s + l.qty, 0)
                    if (totalQty <= 0) return

                    const marketPrice = priceByRoot[root]?.[key]
                    if (marketPrice) {
                        totalValue += totalQty * marketPrice
                    } else {
                        // Fallback: use cost basis if no market price available
                        totalValue += stockLots.reduce((s, l) => s + l.qty * l.cost, 0)
                    }
                })

                monthlyPortfolioValue[key] = totalValue
            }
        }

        // Step 3: Compute monthly returns using Modified Dietz
        const matrixYears = []
        for (let y = Math.max(startYear, currentYear - 2); y <= currentYear; y++) {
            matrixYears.push(y)
        }

        const matrix = matrixYears.map(year => {
            let ytd = 0
            const months = Array.from({ length: 12 }, (_, m) => {
                // Exclude current month (incomplete) and future months
                if (year === currentYear && m >= currentMonth) return null
                if (year === startYear && m < firstDate.getMonth()) return null

                const key = `${year}-${m}`
                const prevKey = m === 0 ? `${year - 1}-11` : `${year}-${m - 1}`

                const endVal = monthlyPortfolioValue[key]
                const startVal = monthlyPortfolioValue[prevKey]

                if (endVal === undefined || startVal === undefined || startVal === 0) return null

                // Cash flow during the month (new money in or out)
                let cashFlow = 0
                sortedTxns.forEach((txn: any) => {
                    const txnDate = new Date(txn.date)
                    if (txnDate.getFullYear() === year && txnDate.getMonth() === m) {
                        const val = Number(txn.quantity) * Number(txn.price)
                        if (txn.transaction_type === 'Buy') cashFlow += val
                        else if (txn.transaction_type === 'Sell') cashFlow -= val
                    }
                })

                // Modified Dietz return: (End - Start - CashFlow) / (Start + 0.5 * CashFlow)
                const denominator = startVal + 0.5 * cashFlow
                if (denominator <= 0) return null

                const ret = ((endVal - startVal - cashFlow) / denominator) * 100
                const capped = Math.max(-50, Math.min(50, ret))
                ytd += capped
                return capped
            })

            return { year, months, ytd }
        })

        return NextResponse.json({ matrix })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
