import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Admin Client (Bypass RLS to update public assets table)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST() {
  try {
    // 1. Find assets with missing sector info (Limit 5 to prevent timeout)
    const { data: assets } = await supabase
      .from('assets')
      .select('id, ticker')
      .or('sector.is.null,sector.eq.Unknown,industry.is.null,industry.eq.Unknown')
      .limit(5)

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'All assets are synced!', processed: 0 })
    }

    const updates = []

    // 2. Loop and Fetch from Yahoo
    for (const asset of assets) {
      let cleanTicker = asset.ticker.toUpperCase().replace(/\s/g, '')
      
      // Skip Commodities (Manual update or set default)
      if (cleanTicker.startsWith('COMMODITY:')) {
          updates.push({ id: asset.id, sector: 'Commodities', industry: 'Commodities' })
          continue
      }

      if (!cleanTicker.includes('.') && !cleanTicker.includes('^')) cleanTicker += '.NS'

      try {
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${cleanTicker}?modules=assetProfile`
        const res = await fetch(url, { next: { revalidate: 0 } })
        const json = await res.json()
        const profile = json?.quoteSummary?.result?.[0]?.assetProfile

        if (profile) {
            updates.push({
                id: asset.id,
                sector: profile.sector || 'Others',
                industry: profile.industry || 'Others'
            })
        } else {
            // Mark as 'Others' so we don't keep retrying failed ones infinitely
            updates.push({ id: asset.id, sector: 'Others', industry: 'Others' })
        }
      } catch (e) {
        console.error(`Failed to fetch ${cleanTicker}`)
      }
    }

    // 3. Write updates back to DB
    for (const update of updates) {
        await supabase
            .from('assets')
            .update({ sector: update.sector, industry: update.industry })
            .eq('id', update.id)
    }

    return NextResponse.json({ 
        message: `Synced ${updates.length} assets`, 
        processed: updates.length,
        remaining: true // Hint to frontend to call again
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}