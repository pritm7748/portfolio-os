import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST() {
  try {
    const { data: assets } = await supabase
      .from('assets')
      .select('id, ticker')
      .or('sector.is.null,sector.eq.Unknown,industry.is.null,industry.eq.Unknown')
      .limit(5)

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'All assets are synced!', processed: 0 })
    }

    const updates = []

    for (const asset of assets) {
      let cleanTicker = asset.ticker.toUpperCase().replace(/\s/g, '')
      
      if (cleanTicker.startsWith('COMMODITY:')) {
          updates.push({ id: asset.id, sector: 'Commodities', industry: 'Commodities' })
          continue
      }

      if (!cleanTicker.includes('.') && !cleanTicker.includes('^')) cleanTicker += '.NS'

      try {
        // FIX: Added encodeURIComponent and User-Agent Header
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(cleanTicker)}?modules=assetProfile`
        
        const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            next: { revalidate: 0 } 
        })
        const json = await res.json()
        const profile = json?.quoteSummary?.result?.[0]?.assetProfile

        if (profile) {
            updates.push({
                id: asset.id,
                sector: profile.sector || 'Others',
                industry: profile.industry || 'Others'
            })
        } else {
            updates.push({ id: asset.id, sector: 'Others', industry: 'Others' })
        }
      } catch (e) {
        console.error(`Failed to fetch ${cleanTicker}`)
        // Mark as Others so we don't get stuck in a loop
        updates.push({ id: asset.id, sector: 'Others', industry: 'Others' })
      }
    }

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