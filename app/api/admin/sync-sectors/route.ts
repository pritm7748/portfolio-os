import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

// Initialize Admin Client (Bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST() {
  try {
    // 1. Fetch assets that need updating
    // We target 'Unknown' OR null. We also re-try 'Others' in case previous logic failed.
    const { data: assets } = await supabase
      .from('assets')
      .select('id, ticker')
      .or('sector.is.null,sector.eq.Unknown,sector.eq.Others,sector.eq.Unclassified')
      .limit(5) // Process 5 at a time to ensure we don't timeout

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'All assets synced', processed: 0 })
    }

    const updates = []

    for (const asset of assets) {
      let cleanTicker = asset.ticker.toUpperCase().replace(/\s/g, '')
      let sector = 'Unknown'
      let industry = 'Unknown'

      console.log(`Processing: ${cleanTicker}`)

      // A. Commodity Check
      if (cleanTicker.startsWith('COMMODITY:')) {
          updates.push({ id: asset.id, sector: 'Commodities', industry: 'Commodities' })
          continue
      }

      // B. Prepare Symbols
      let symbol = cleanTicker.split('.')[0]
      let yahooTicker = cleanTicker
      if (!yahooTicker.includes('.') && !yahooTicker.includes('^')) yahooTicker += '.NS'

      // --- STRATEGY 1: SCREENER SCRAPING (Primary) ---
      try {
          const screenerUrl = `https://www.screener.in/company/${symbol}/`
          const res = await fetch(screenerUrl, {
              headers: { 
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
              },
              next: { revalidate: 0 }
          })

          if (res.ok) {
              const html = await res.text()
              const $ = cheerio.load(html)

              // ROBUST FINDER: Look for the "Peer comparison" header, then find links nearby
              // The structure is usually a div with class "flex-row" containing the h2 and links
              const peersHeader = $('h2:contains("Peer comparison")')
              
              if (peersHeader.length > 0) {
                  // Get the parent container or siblings
                  const container = peersHeader.parent()
                  const links = container.find('a')
                  
                  const breadcrumbs: string[] = []
                  
                  links.each((_, el) => {
                      const text = $(el).text().trim()
                      const href = $(el).attr('href') || ''
                      
                      // Filter for sector links (usually contain /screens/ or are simple text links)
                      // Exclude "Detailed Comparison"
                      if (text && !text.includes('Detailed') && !text.includes('Customize') && !href.includes('/compare/')) {
                          breadcrumbs.push(text)
                      }
                  })

                  if (breadcrumbs.length > 0) {
                      sector = breadcrumbs[0]
                      // If we have > 1 crumb, the last one is likely Industry. If only 1, Sector=Industry.
                      industry = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1] : sector
                      console.log(`Screener found: ${sector} > ${industry}`)
                  }
              }
          }
      } catch (e) {
          console.error(`Screener failed for ${symbol}`, e)
      }

      // --- STRATEGY 2: YAHOO FALLBACK ---
      // If Screener failed (sector is still Unknown), try Yahoo
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
                console.log(`Yahoo found: ${sector} > ${industry}`)
            }
          } catch (e) {
            console.error(`Yahoo failed for ${yahooTicker}`)
          }
      }

      // If still failed, mark as 'Unclassified' to stop the sync loop from retrying indefinitely
      if (sector === 'Unknown') sector = 'Unclassified'
      if (industry === 'Unknown') industry = 'Unclassified'

      updates.push({ id: asset.id, sector, industry })
    }

    // 3. Batch Update DB
    // We update one by one to ensure partial successes are saved
    for (const update of updates) {
        const { error } = await supabase
            .from('assets')
            .update({ sector: update.sector, industry: update.industry })
            .eq('id', update.id)
        
        if (error) console.error(`DB Update failed for ID ${update.id}`, error)
    }

    return NextResponse.json({ 
        message: `Synced ${updates.length} assets`, 
        processed: updates.length,
        remaining: true 
    })

  } catch (error: any) {
    console.error("Sync Route Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}