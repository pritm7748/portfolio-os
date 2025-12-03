import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

// Initialize Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST() {
  try {
    // 1. Fetch ALL assets that need updating (No Limit)
    const { data: assets } = await supabase
      .from('assets')
      .select('id, ticker')
      .or('sector.is.null,sector.eq.Unknown,sector.eq.Unclassified,industry.is.null')

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'All assets synced', processed: 0 })
    }

    const updates = []
    
    // Process sequentially to avoid rate limits
    for (const asset of assets) {
      let cleanTicker = asset.ticker.toUpperCase().replace(/\s/g, '')
      let sector = 'Unknown'
      let industry = 'Unknown'

      // A. Commodity Check
      if (cleanTicker.startsWith('COMMODITY:')) {
          updates.push({ id: asset.id, sector: 'Commodities', industry: 'Commodities' })
          continue
      }

      let symbol = cleanTicker.split('.')[0]
      let yahooTicker = cleanTicker
      if (!yahooTicker.includes('.') && !yahooTicker.includes('^')) yahooTicker += '.NS'

      // --- STRATEGY 1: SCREENER (Targeted Link Search) ---
      try {
          const res = await fetch(`https://www.screener.in/company/${symbol}/`, {
              headers: { 
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              cache: 'no-store'
          })

          if (res.ok) {
              const html = await res.text()
              const $ = cheerio.load(html)

              // Method: Find links that specifically point to sector screens
              // Screener links look like: /screens/sector/finance/ or /screens/industry/banks-private-sector/
              const sectorLink = $('a[href*="/screens/sector/"]').first()
              const industryLink = $('a[href*="/screens/industry/"]').first()

              if (sectorLink.length > 0) {
                  sector = sectorLink.text().trim()
              }
              
              if (industryLink.length > 0) {
                  industry = industryLink.text().trim()
              } else if (sector !== 'Unknown') {
                  industry = sector // Fallback
              }
          }
      } catch (e) {
          console.error(`Screener failed for ${symbol}`)
      }

      // --- STRATEGY 2: YAHOO FALLBACK ---
      if (sector === 'Unknown') {
          try {
            const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=assetProfile`
            const res = await fetch(url, { 
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 0 } 
            })
            const json = await res.json()
            const profile = json?.quoteSummary?.result?.[0]?.assetProfile

            if (profile) {
                if (profile.sector) sector = profile.sector
                if (profile.industry) industry = profile.industry
            }
          } catch (e) { /* Ignore */ }
      }

      // Default to Unclassified to prevent infinite loops
      if (sector === 'Unknown') sector = 'Unclassified'
      if (industry === 'Unknown') industry = 'Unclassified'

      // Update Database Immediately (one by one to save progress)
      await supabase
        .from('assets')
        .update({ sector, industry })
        .eq('id', asset.id)

      updates.push({ ticker: asset.ticker, sector, industry })
      
      // Tiny delay to be polite to servers
      await new Promise(r => setTimeout(r, 200))
    }

    return NextResponse.json({ 
        message: `Synced ${updates.length} assets successfully`, 
        processed: updates.length,
        details: updates
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}