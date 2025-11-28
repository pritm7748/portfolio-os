import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    const { data: assets } = await supabase.from('assets').select('ticker, id').not('ticker', 'is', null)
    if (!assets || assets.length === 0) return NextResponse.json({ message: 'No assets found' })

    let processedCount = 0
    const logs: string[] = []

    for (const asset of assets) {
        const ticker = asset.ticker
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        if (!yahooTicker.includes('.') && !yahooTicker.includes('-')) yahooTicker += '.NS'

        // FETCH SPLITS (Last 30 Days to Today + 1 Day for timezone safety)
        // We focus on recent splits for the auto-scanner
        const period1 = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60) 
        const period2 = Math.floor(Date.now() / 1000) + (24 * 60 * 60) 
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=split`

        try {
            const res = await fetch(url)
            const data = await res.json()
            const splitsObj = data?.chart?.result?.[0]?.events?.splits

            if (!splitsObj) continue

            const splits = Object.values(splitsObj) as any[]

            for (const split of splits) {
                const exDate = new Date(split.date * 1000).toISOString().split('T')[0]
                const ratioNumerator = split.numerator
                const ratioDenominator = split.denominator
                const ratioString = `${ratioNumerator}:${ratioDenominator}`

                // 1. Check if already applied
                const { data: existing } = await supabase
                    .from('applied_actions')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('ticker', ticker)
                    .eq('ex_date', exDate)
                    .single()

                if (existing) continue 

                // 2. Calculate Factor
                const factor = ratioNumerator / ratioDenominator

                // 3. Fetch Transactions created BEFORE Ex-Date
                // We use 'created_at' to ensure we only adjust trades that existed pre-split
                const { data: txns } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('asset_id', asset.id)
                    .lt('created_at', exDate) // <--- The Critical Check

                if (!txns || txns.length === 0) {
                    // Log as "Skipped/No Holdings" so we don't re-process empty events
                    // await supabase.from('applied_actions').insert({ ... }) <-- Optional: Uncomment if you want to permanently ignore
                    continue
                }

                // 4. Apply Updates
                for (const txn of txns) {
                    const newQty = Number(txn.quantity) * factor
                    const newPrice = Number(txn.price) / factor
                    
                    await supabase
                        .from('transactions')
                        .update({ quantity: newQty, price: newPrice })
                        .eq('id', txn.id)
                }

                // 5. Record Action
                await supabase.from('applied_actions').insert({
                    user_id: userId, ticker, ex_date: exDate, ratio: ratioString
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}