import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // Skip commodities
    if (cleanTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 

    // Detect Indian Stock
    const isIndian = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') || (!cleanTicker.includes('.') && !cleanTicker.includes('^'))
    
    // Variables to hold data
    let marketCap = 0
    let peRatio = 0
    let divYield = 0
    let high52 = 0
    let low52 = 0
    let currentPrice = 0
    let symbol = cleanTicker

    // 1. FETCH FUNDAMENTALS FROM SCREENER.IN (Market Cap, P/E, Div Yield)
    if (isIndian) {
        const symbolClean = cleanTicker.split('.')[0]
        try {
            const screenerUrl = `https://www.screener.in/company/${symbolClean}/`
            const res = await fetch(screenerUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                next: { revalidate: 300 } 
            })
            
            if (res.ok) {
                const html = await res.text()
                const $ = cheerio.load(html)
                
                // Parse the #top-ratios list
                $('#top-ratios li').each((_, el) => {
                    const name = $(el).find('.name').text().trim().toLowerCase()
                    const valueText = $(el).find('.value').text().trim()
                    // Remove commas before parsing
                    const valClean = valueText.replace(/,/g, '')

                    if (name.includes('market cap')) {
                        // Screener gives value in Crores. We return raw number.
                        marketCap = parseFloat(valClean) * 10000000 
                    } 
                    else if (name.includes('stock p/e')) {
                        peRatio = parseFloat(valClean)
                    } 
                    else if (name.includes('dividend yield')) {
                        divYield = parseFloat(valClean) / 100
                    }
                })
            }
        } catch (err) {
            console.warn(`Screener fetch failed for ${symbolClean}`, err)
        }
    }

    // 2. FETCH HIGH/LOW FROM YAHOO FINANCE (Reliable Backup)
    // We use this for 52W High/Low because Screener's format ("4500 / 3200") is harder to parse reliably
    
    if (!cleanTicker.includes('.') && !cleanTicker.includes('^')) cleanTicker += '.NS'

    try {
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?interval=1d&range=1d`
        const res = await fetch(chartUrl, { next: { revalidate: 300 } })
        const data = await res.json()
        const meta = data?.chart?.result?.[0]?.meta

        if (meta) {
            // Always overwrite High/Low with Yahoo data (it's more up-to-date)
            high52 = meta.fiftyTwoWeekHigh || 0
            low52 = meta.fiftyTwoWeekLow || 0
            currentPrice = meta.regularMarketPrice || 0
            symbol = meta.symbol || cleanTicker
            
            // Fallbacks if Screener failed entirely
            if (marketCap === 0 && meta.marketCap) marketCap = meta.marketCap
        }
    } catch (err) {
        console.warn(`Yahoo fetch failed for ${cleanTicker}`, err)
    }

    // Final Check
    if (marketCap === 0 && high52 === 0) {
         return NextResponse.json({ error: 'Data unavailable' }, { status: 404 })
    }

    return NextResponse.json({
        marketCap,
        peRatio,
        high52,
        low52,
        divYield,
        currency: 'INR',
        symbol
    })

  } catch (error: any) {
    console.error("Quote Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}