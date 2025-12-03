import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Admin Client (Bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST() {
  try {
    // 1. Find assets with missing sector info
    // We check for NULL or 'Unknown'
    const { data: assets } = await supabase
      .from('assets')
      .select('id, ticker')
      .or('sector.is.null,sector.eq.Unknown,industry.is.null,industry.eq.Unknown')
      .limit(10) // Process 10 at a time to stay within Vercel timeout limits

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'All assets are synced!', processed: 0 })
    }

    const updates = []

    for (const asset of assets) {
      let cleanTicker = asset.ticker.toUpperCase().replace(/\s/g, '')
      let sector = 'Unknown'
      let industry = 'Unknown'

      // A. Skip Commodities (Hardcode them)
      if (cleanTicker.startsWith('COMMODITY:')) {
          updates.push({ id: asset.id, sector: 'Commodities', industry: 'Commodities' })
          continue
      }

      // B. Format Ticker for Yahoo
      if (!cleanTicker.includes('.') && !cleanTicker.includes('^')) cleanTicker += '.NS'

      // C. Fetch from Yahoo
      try {
        const encodedTicker = encodeURIComponent(cleanTicker)
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodedTicker}?modules=assetProfile`
        
        const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            next: { revalidate: 0 } // No cache for sync
        })
        
        if (res.ok) {
            const json = await res.json()
            const profile = json?.quoteSummary?.result?.[0]?.assetProfile

            if (profile) {
                if (profile.sector) sector = profile.sector
                if (profile.industry) industry = profile.industry
            }
        }
      } catch (e) {
        console.error(`Sync failed for ${cleanTicker}`)
      }

      // If still unknown after fetch, mark as 'Unclassified' so we don't loop forever
      if (sector === 'Unknown') sector = 'Unclassified'
      if (industry === 'Unknown') industry = 'Unclassified'

      updates.push({ id: asset.id, sector, industry })
    }

    // 2. Batch Update DB
    for (const update of updates) {
        await supabase
            .from('assets')
            .update({ sector: update.sector, industry: update.industry })
            .eq('id', update.id)
    }

    return NextResponse.json({ 
        message: `Synced ${updates.length} assets`, 
        processed: updates.length,
        remaining: true 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}