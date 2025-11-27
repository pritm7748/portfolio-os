import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    // 1. Initialize Admin Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. OPTIMIZATION: Get ONLY assets the user actually owns
    // We join transactions with assets to get the tickers relevant to this user
    const { data: userHoldings, error: fetchError } = await supabase
        .from('transactions')
        .select('asset:assets!inner(id, ticker)')
        .eq('user_id', userId)

    if (fetchError) throw fetchError
    if (!userHoldings || userHoldings.length === 0) return NextResponse.json({ message: 'No holdings found' })

    // Deduplicate assets (User might have 10 buys for TCS, we only need to check TCS once)
    const uniqueAssetsMap = new Map()
    userHoldings.forEach((item: any) => {
        if (item.asset) uniqueAssetsMap.set(item.asset.ticker, item.asset)
    })
    const assets = Array.from(uniqueAssetsMap.values())

    let processedCount = 0
    const logs: string[] = []

    // 3. Iterate User's Tickers
    for (const asset of assets) {
        const ticker = asset.ticker
        
        // Yahoo Finance Ticker Formatting
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        if (!yahooTicker.includes('.') && !yahooTicker.includes('-')) yahooTicker += '.NS'

        // 4. Fetch Splits from Yahoo (Look back 5 years)
        const period1 = Math.floor(Date.now() / 1000) - (5 * 365 * 24 * 60 * 60)
        const period2 = Math.floor(Date.now() / 1000)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=split`

        try {
            const res = await fetch(url)
            const data = await res.json()
            const splitsObj = data?.chart?.result?.[0]?.events?.splits

            if (!splitsObj) continue

            const splits = Object.values(splitsObj) as any[]

            // 5. Process Each Split
            for (const split of splits) {
                const exDate = new Date(split.date * 1000).toISOString().split('T')[0] // YYYY-MM-DD
                const ratioNumerator = split.numerator
                const ratioDenominator = split.denominator
                const ratioString = `${ratioNumerator}:${ratioDenominator}`

                // A. Check if already applied (Idempotency)
                const { data: existing } = await supabase
                    .from('applied_actions')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('ticker', ticker)
                    .eq('ex_date', exDate)
                    .single()

                if (existing) continue // Skip if already done

                // B. Calculate Factor
                // Yahoo 5:1 means "5 new for 1 old". Factor = 5.
                const factor = ratioNumerator / ratioDenominator

                // C. Fetch Transactions BEFORE Ex-Date
                const { data: txns } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('asset_id', asset.id)
                    .lt('date', exDate)

                if (!txns || txns.length === 0) {
                    // Log it so we don't re-check this irrelevant split
                    await supabase.from('applied_actions').insert({
                        user_id: userId, ticker, ex_date: exDate, ratio: ratioString, action_type: 'SPLIT'
                    })
                    continue
                }

                // D. Apply Updates
                for (const txn of txns) {
                    const newQty = Number(txn.quantity) * factor
                    const newPrice = Number(txn.price) / factor
                    
                    await supabase
                        .from('transactions')
                        .update({ quantity: newQty, price: newPrice })
                        .eq('id', txn.id)
                }

                // E. Log Success
                await supabase.from('applied_actions').insert({
                    user_id: userId, ticker, ex_date: exDate, ratio: ratioString, action_type: 'SPLIT'
                })
                
                logs.push(`Applied ${ratioString} split for ${ticker} on ${exDate}`)
                processedCount++
            }
        } catch (err) {
            console.error(`Failed to process ${ticker}`, err)
        }
    }

    return NextResponse.json({ success: true, processed: processedCount, logs })

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}