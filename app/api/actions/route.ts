import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service Role key needed to bypass RLS for batch updates
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    // 1. Initialize Admin Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Get User's Distinct Tickers
    const { data: assets } = await supabase
        .from('assets')
        .select('ticker, id')
        .not('ticker', 'is', null)

    if (!assets || assets.length === 0) return NextResponse.json({ message: 'No assets found' })

    let processedCount = 0
    const logs: string[] = []

    // 3. Iterate Tickers
    for (const asset of assets) {
        const ticker = asset.ticker
        // Convert to Yahoo format
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        if (!yahooTicker.includes('.') && !yahooTicker.includes('-')) yahooTicker += '.NS'

        // 4. Fetch Splits from Yahoo (5 Years)
        const period1 = Math.floor(Date.now() / 1000) - (5 * 365 * 24 * 60 * 60)
        const period2 = Math.floor(Date.now() / 1000)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=split`

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

            // A. Check if already applied to this user/ticker/date
            const { data: existing } = await supabase
                .from('applied_actions')
                .select('id')
                .eq('user_id', userId)
                .eq('ticker', ticker)
                .eq('ex_date', exDate)
                .single()

            if (existing) continue 

            // B. Calculate Factor
            const factor = ratioNumerator / ratioDenominator

            // C. Fetch Transactions created BEFORE the split Ex-Date
            // CRITICAL CHANGE: Check 'created_at', not 'date' (Trade Date)
            // This ensures we only modify records that existed in the system *before* the split event.
            const { data: txns } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .eq('asset_id', asset.id)
                .lt('created_at', exDate) // <--- THE FIX

            if (!txns || txns.length === 0) {
                // No relevant transactions found (user entered data after split, or didn't own it then)
                // Log it so we don't check again
                await supabase.from('applied_actions').insert({
                    user_id: userId, ticker, ex_date: exDate, ratio: ratioString
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
                user_id: userId, ticker, ex_date: exDate, ratio: ratioString
            })
            
            logs.push(`Applied ${ratioString} split for ${ticker} on ${exDate}`)
            processedCount++
        }
    }

    return NextResponse.json({ success: true, processed: processedCount, logs })

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}