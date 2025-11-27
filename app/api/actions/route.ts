import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin Client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    // -------------------------------------------------------------------------
    // STEP 1: Get User's Asset IDs (Fail-Safe Query)
    // -------------------------------------------------------------------------
    const { data: txns, error: txnError } = await supabaseAdmin
        .from('transactions')
        .select('asset_id')
        .eq('user_id', userId)

    if (txnError) throw txnError
    if (!txns || txns.length === 0) {
        return NextResponse.json({ success: true, processed: 0, message: "No transactions found" })
    }

    // Extract Unique Asset IDs
    const assetIds = [...new Set(txns.map((t) => t.asset_id))]

    // -------------------------------------------------------------------------
    // STEP 2: Get Tickers for these IDs
    // -------------------------------------------------------------------------
    const { data: assets, error: assetError } = await supabaseAdmin
        .from('assets')
        .select('id, ticker')
        .in('id', assetIds)

    if (assetError) throw assetError
    if (!assets || assets.length === 0) {
        return NextResponse.json({ success: true, processed: 0, message: "No assets found" })
    }

    let processedCount = 0
    const logs: string[] = []

    // -------------------------------------------------------------------------
    // STEP 3: Iterate Tickers & Check Yahoo
    // -------------------------------------------------------------------------
    for (const asset of assets) {
        const ticker = asset.ticker
        
        // Skip Commodities/Currencies, only check Stocks
        if (ticker.includes('COMMODITY') || ticker.includes('=')) continue;

        // Yahoo Format
        let yahooTicker = ticker.toUpperCase().replace(/\s/g, '')
        if (!yahooTicker.includes('.') && !yahooTicker.includes('-')) yahooTicker += '.NS'

        // Fetch History (Last 5 years)
        const period1 = Math.floor(Date.now() / 1000) - (5 * 365 * 24 * 60 * 60)
        const period2 = Math.floor(Date.now() / 1000)
        
        // Added 'events=div|split' to be safe, though we only parse splits
        // Added Cache-Control to prevent stale data
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=split`

        try {
            const res = await fetch(url, { cache: 'no-store' })
            if (!res.ok) {
                console.warn(`Yahoo API Error for ${yahooTicker}: ${res.status}`)
                continue
            }
            
            const data = await res.json()
            const splitsObj = data?.chart?.result?.[0]?.events?.splits
            
            if (!splitsObj) continue 

            const splits = Object.values(splitsObj) as any[]

            for (const split of splits) {
                const exDate = new Date(split.date * 1000).toISOString().split('T')[0]
                const ratioNumerator = split.numerator
                const ratioDenominator = split.denominator
                const ratioString = `${ratioNumerator}:${ratioDenominator}`
                const factor = ratioNumerator / ratioDenominator

                // -----------------------------------------------------------------
                // CHECK: Has this specific split been applied for this user?
                // -----------------------------------------------------------------
                const { data: existing } = await supabaseAdmin
                    .from('applied_actions')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('ticker', ticker)
                    .eq('ex_date', exDate)
                    .maybeSingle()

                if (existing) continue // Already processed

                // -----------------------------------------------------------------
                // FETCH: Transactions BEFORE the Ex-Date
                // -----------------------------------------------------------------
                const { data: affectedTxns } = await supabaseAdmin
                    .from('transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('asset_id', asset.id)
                    .lt('date', exDate)

                if (!affectedTxns || affectedTxns.length === 0) {
                     // Record as 'skipped' so we don't re-check every time
                     await supabaseAdmin.from('applied_actions').insert({
                        user_id: userId, ticker, ex_date: exDate, ratio: ratioString, action_type: 'SKIPPED_NO_HOLDING'
                     })
                     continue
                }

                // -----------------------------------------------------------------
                // APPLY: Update Quantity & Price
                // -----------------------------------------------------------------
                for (const txn of affectedTxns) {
                    const newQty = Number(txn.quantity) * factor
                    const newPrice = Number(txn.price) / factor
                    
                    await supabaseAdmin
                        .from('transactions')
                        .update({ quantity: newQty, price: newPrice })
                        .eq('id', txn.id)
                }

                // Log Success
                await supabaseAdmin.from('applied_actions').insert({
                    user_id: userId, ticker, ex_date: exDate, ratio: ratioString, action_type: 'SPLIT_AUTO'
                })
                
                processedCount++
                logs.push(`Applied ${ratioString} split for ${ticker} on ${exDate}`)
            }
        } catch (e) {
            console.error(`Error processing ${ticker}`, e)
        }
    }

    return NextResponse.json({ success: true, processed: processedCount, logs })

  } catch (error: any) {
    console.error("API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Keep GET for Cron (Optional placeholder)
export async function GET(request: Request) {
    return NextResponse.json({ message: 'Use POST for user trigger' })
}