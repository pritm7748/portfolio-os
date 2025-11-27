import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin Client (Bypass RLS to ensure we can read/write freely)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    console.log(`[Actions] Starting check for User: ${userId}`)

    // 1. SIMPLE QUERY: Get all Asset IDs the user has ever touched
    const { data: txns, error: txnError } = await supabaseAdmin
        .from('transactions')
        .select('asset_id')
        .eq('user_id', userId)

    if (txnError) throw txnError
    if (!txns || txns.length === 0) {
        console.log('[Actions] No transactions found.')
        return NextResponse.json({ success: true, processed: 0, message: "No transactions found" })
    }

    // Deduplicate IDs
    const assetIds = [...new Set(txns.map((t) => t.asset_id))]
    console.log(`[Actions] Found ${assetIds.length} unique assets to check.`)

    // 2. SIMPLE QUERY: Get Ticker symbols for those IDs
    const { data: assets, error: assetError } = await supabaseAdmin
        .from('assets')
        .select('id, ticker')
        .in('id', assetIds)

    if (assetError) throw assetError

    let processedCount = 0
    const logs: string[] = []

    // 3. Iterate and Check Yahoo
    for (const asset of assets || []) {
        const ticker = asset.ticker
        
        // Skip non-stock assets
        if (ticker.includes('COMMODITY') || ticker.includes('=')) continue;

        // Clean Ticker for Yahoo
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        if (!yahooTicker.includes('.') && !yahooTicker.includes('-')) yahooTicker += '.NS'

        // Look back 5 years
        const period1 = Math.floor(Date.now() / 1000) - (5 * 365 * 24 * 60 * 60)
        const period2 = Math.floor(Date.now() / 1000)
        
        // URL Construction (No Cache)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=split`

        try {
            const res = await fetch(url, { cache: 'no-store' })
            
            if (!res.ok) {
                console.warn(`[Actions] Yahoo Fetch Failed ${res.status} for ${yahooTicker}`)
                continue
            }

            const data = await res.json()
            const splitsObj = data?.chart?.result?.[0]?.events?.splits

            if (!splitsObj) {
                // console.log(`[Actions] No splits found for ${yahooTicker}`)
                continue 
            }

            const splits = Object.values(splitsObj) as any[]
            console.log(`[Actions] Found ${splits.length} splits for ${yahooTicker}`)

            for (const split of splits) {
                const exDate = new Date(split.date * 1000).toISOString().split('T')[0]
                const ratioNumerator = split.numerator
                const ratioDenominator = split.denominator
                const ratioString = `${ratioNumerator}:${ratioDenominator}`
                const factor = ratioNumerator / ratioDenominator

                // CHECK: Did we already do this?
                const { data: existing } = await supabaseAdmin
                    .from('applied_actions')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('ticker', ticker)
                    .eq('ex_date', exDate)
                    .maybeSingle()

                if (existing) {
                    // console.log(`[Actions] Skipping ${ticker} on ${exDate} (Already Applied)`)
                    continue
                }

                // CHECK: Does user have holdings BEFORE this date?
                const { data: affectedTxns } = await supabaseAdmin
                    .from('transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('asset_id', asset.id)
                    .lt('date', exDate)

                if (!affectedTxns || affectedTxns.length === 0) {
                     // Mark as skipped so we don't re-check
                     await supabaseAdmin.from('applied_actions').insert({
                        user_id: userId, ticker, ex_date: exDate, ratio: ratioString, action_type: 'SKIPPED_NO_HOLDING'
                     })
                     continue
                }

                console.log(`[Actions] APPLYING SPLIT: ${ticker} on ${exDate}. Factor: ${factor}. Txns: ${affectedTxns.length}`)

                // APPLY UPDATES
                for (const txn of affectedTxns) {
                    const newQty = Number(txn.quantity) * factor
                    const newPrice = Number(txn.price) / factor
                    
                    await supabaseAdmin
                        .from('transactions')
                        .update({ quantity: newQty, price: newPrice })
                        .eq('id', txn.id)
                }

                // LOG SUCCESS
                await supabaseAdmin.from('applied_actions').insert({
                    user_id: userId, ticker, ex_date: exDate, ratio: ratioString, action_type: 'SPLIT_AUTO'
                })
                
                processedCount++
                logs.push(`Applied ${ratioString} split for ${ticker} on ${exDate}`)
            }
        } catch (e) {
            console.error(`[Actions] Error processing ${ticker}`, e)
        }
    }

    return NextResponse.json({ success: true, processed: processedCount, logs })

  } catch (error: any) {
    console.error("[Actions] Fatal Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}