import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST() {
  try {
    // 1. Find assets with missing sector (Limit 5 to prevent timeouts)
    const { data: assets } = await supabase
      .from('assets')
      .select('id, ticker')
      .or('sector.is.null,sector.eq.Unknown,industry.is.null,industry.eq.Unknown')
      .limit(5)

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'All assets synced', processed: 0 })
    }

    const updates = []

    for (const asset of assets) {
      let cleanTicker = asset.ticker.toUpperCase().replace(/\s/g, '')
      let sector = 'Unknown'
      let industry = 'Unknown'

      // A. Commodity Check
      if (cleanTicker.startsWith('COMMODITY:')) {
          updates.push({ id: asset.id, sector: 'Commodities', industry: 'Commodities' })
          continue
      }

      // B. Prepare Symbols
      // Screener uses "TCS", Yahoo uses "TCS.NS"
      let symbol = cleanTicker.split('.')[0]
      let yahooTicker = cleanTicker
      if (!yahooTicker.includes('.') && !yahooTicker.includes('^')) yahooTicker += '.NS'

      // --- STRATEGY 1: SCREENER SCRAPING (Primary) ---
      // We look for the "Peer comparison" section
      try {
          const screenerUrl = `https://www.screener.in/company/${symbol}/`
          const res = await fetch(screenerUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              next: { revalidate: 0 } // No cache for sync
          })

          if (res.ok) {
              const html = await res.text()
              const $ = cheerio.load(html)

              // Find the Peer Comparison section
              // It usually contains links like: Sector > Industry > Name
              const peersSection = $('#peers')
              if (peersSection.length > 0) {
                  const links = peersSection.find('a')
                  const breadcrumbs: string[] = []

                  links.each((_, el) => {
                      const text = $(el).text().trim()
                      const href = $(el).attr('href')
                      // Filter out unrelated links (like "Customize" or "Detailed")
                      if (text && href && href.includes('/company/compare/')) {
                          breadcrumbs.push(text)
                      }
                  })

                  if (breadcrumbs.length > 0) {
                      // First link is usually Sector (e.g. "Financial Services")
                      sector = breadcrumbs[0]
                      // Second or Last link is Industry (e.g. "Banks - Private")
                      industry = breadcrumbs.length > 1 ? breadcrumbs[1] : sector
                  }
              }
          }
      } catch (e) {
          console.error(`Screener sync failed for ${symbol}`, e)
      }

      // --- STRATEGY 2: YAHOO FALLBACK ---
      // If Screener failed (or didn't have the data), try Yahoo
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
          } catch (e) {
            console.error(`Yahoo sync failed for ${yahooTicker}`)
          }
      }

      // Mark as 'Unclassified' if completely failed so we don't loop forever
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