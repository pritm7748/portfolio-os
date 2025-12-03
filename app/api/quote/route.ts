import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // 1. Commodity Check
    if (cleanTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ 
             marketCap: 0, peRatio: 0, high52: 0, low52: 0, divYield: 0, currency: 'INR', symbol: cleanTicker,
             sector: 'Commodities', industry: 'Commodities' 
         })
    } 

    let sector = 'Unknown'
    let industry = 'Unknown'
    let marketCap = 0, peRatio = 0, high52 = 0, low52 = 0, divYield = 0
    let currency = 'INR'
    let symbol = cleanTicker.split('.')[0]

    // 2. Standardize Ticker
    const isIndian = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') || (!cleanTicker.includes('.') && !cleanTicker.includes('^'))
    
    // --- STRATEGY A: SCREENER (Primary for Indian Stocks) ---
    if (isIndian) {
        try {
            const screenerUrl = `https://www.screener.in/company/${symbol}/`
            const res = await fetch(screenerUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 300 } 
            })
            
            if (res.ok) {
                const html = await res.text()
                const $ = cheerio.load(html)
                
                // 1. Parse Fundamentals
                $('#top-ratios li').each((_, el) => {
                    const name = $(el).find('.name').text().trim().toLowerCase()
                    const valueText = $(el).find('.value').text().trim()
                    const cleanNumber = (str: string) => parseFloat(str.replace(/[^\d.]/g, '')) || 0

                    if (name.includes('market cap')) marketCap = cleanNumber(valueText) * 10000000
                    else if (name.includes('stock p/e')) peRatio = cleanNumber(valueText)
                    else if (name.includes('dividend yield')) divYield = cleanNumber(valueText) / 100
                    else if (name.includes('high') && name.includes('low')) {
                        const parts = valueText.split('/')
                        if (parts.length === 2) { high52 = cleanNumber(parts[0]); low52 = cleanNumber(parts[1]) }
                    }
                })

                // 2. NEW: Parse Sector/Industry from "Peer comparison"
                const peerSection = $('#peers')
                if (peerSection.length > 0) {
                    const links = peerSection.find('a')
                    const breadcrumbs: string[] = []
                    
                    links.each((_, el) => {
                        const text = $(el).text().trim()
                        const href = $(el).attr('href') || ''
                        if (text && !text.includes('Detailed') && !text.includes('Customize') && !href.includes('/compare/')) {
                            breadcrumbs.push(text)
                        }
                    })

                    // Custom Logic for Granular Sectors
                    // Breadcrumbs: [Financial Services, Financial Services, Banks, Private Sector Bank]
                    if (breadcrumbs.length > 0) {
                        if (breadcrumbs.length >= 3) {
                             // Prefer the 3rd item (e.g. "Banks") as the main Sector
                             sector = breadcrumbs[2]
                             // Use the last item as Industry (e.g. "Private Sector Bank")
                             industry = breadcrumbs[breadcrumbs.length - 1]
                        } else {
                             // Fallback for simpler hierarchies
                             sector = breadcrumbs[0]
                             industry = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1] : sector
                        }
                    }
                }

                if (marketCap > 0) {
                    return NextResponse.json({
                        marketCap, peRatio, high52, low52, divYield, currency: 'INR', symbol,
                        sector, industry 
                    })
                }
            }
        } catch (err) { console.warn(`Screener fetch failed for ${symbol}`, err) }
    }

    // --- STRATEGY B: YAHOO (Fallback) ---
    let cleanTickerYahoo = cleanTicker
    if (!cleanTickerYahoo.includes('.') && !cleanTickerYahoo.includes('^')) cleanTickerYahoo += '.NS'

    const [chartRes, profileRes] = await Promise.all([
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanTickerYahoo)}?interval=1d&range=1d`, { next: { revalidate: 300 } }),
        fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(cleanTickerYahoo)}?modules=assetProfile`, { next: { revalidate: 86400 } })
    ])

    const chartJson = await chartRes.json()
    const meta = chartJson?.chart?.result?.[0]?.meta

    if (!meta) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

    // Extract Sector from Yahoo if we didn't get it from Screener
    if (sector === 'Unknown') {
        try {
            const profileJson = await profileRes.json()
            const profile = profileJson?.quoteSummary?.result?.[0]?.assetProfile
            if (profile) {
                if (profile.sector) sector = profile.sector
                if (profile.industry) industry = profile.industry
            }
        } catch(e) { /* Ignore fallback errors */ }
    }

    // Fill Fundamentals from Yahoo if Screener failed
    if (marketCap === 0) {
        marketCap = meta.marketCap || 0
        high52 = meta.fiftyTwoWeekHigh || 0
        low52 = meta.fiftyTwoWeekLow || 0
        currency = meta.currency || 'INR'
        symbol = meta.symbol || symbol
    }

    return NextResponse.json({
        marketCap, peRatio, high52, low52, divYield, currency, symbol,
        sector, 
        industry
    })

  } catch (error: any) {
    console.error("Quote Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}