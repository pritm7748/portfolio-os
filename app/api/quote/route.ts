import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    if (cleanTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 

    // Detect Indian Stock
    const isIndian = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') || (!cleanTicker.includes('.') && !cleanTicker.includes('^'))
    
    if (isIndian) {
        const symbol = cleanTicker.split('.')[0]
        
        try {
            const screenerUrl = `https://www.screener.in/company/${symbol}/`
            const res = await fetch(screenerUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                next: { revalidate: 300 } 
            })
            
            if (res.ok) {
                const html = await res.text()
                const $ = cheerio.load(html)
                
                let marketCap = 0
                let peRatio = 0
                let high52 = 0
                let low52 = 0
                let divYield = 0

                // Robust Loop: Check every item in the top-ratios list
                $('#top-ratios li').each((_, el) => {
                    const name = $(el).find('.name').text().trim().toLowerCase()
                    const valueText = $(el).find('.value').text().trim()
                    
                    // Remove commas for parsing
                    const valClean = valueText.replace(/,/g, '')

                    if (name.includes('market cap')) {
                        marketCap = parseFloat(valClean)
                    } 
                    else if (name.includes('stock p/e')) {
                        peRatio = parseFloat(valClean)
                    } 
                    else if (name.includes('dividend yield')) {
                        divYield = parseFloat(valClean)
                    } 
                    else if (name.includes('high') && name.includes('low')) {
                        // Format is usually "4586 / 3661"
                        // Split by "/" and trim whitespace
                        const parts = valClean.split('/')
                        if (parts.length === 2) {
                            high52 = parseFloat(parts[0].trim())
                            low52 = parseFloat(parts[1].trim())
                        }
                    }
                })

                if (marketCap > 0) {
                    return NextResponse.json({
                        // Screener Market Cap is in Crores.
                        // If you want to show "15.25 L Cr", multiply by 1 Cr (10,000,000)
                        // BUT your UI 'formatLargeNumber' might expect raw units. 
                        // Let's send the full number for consistency.
                        marketCap: marketCap * 10000000, 
                        peRatio,
                        high52,
                        low52,
                        divYield: divYield / 100, 
                        currency: 'INR',
                        symbol: symbol
                    })
                }
            }
        } catch (err) {
            console.warn(`Screener fetch failed for ${symbol}, falling back...`, err)
        }
    }

    // 3. FALLBACK: Yahoo Finance Chart API
    if (!cleanTicker.includes('.') && !cleanTicker.includes('^')) cleanTicker += '.NS'

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?interval=1d&range=1d`
    const res = await fetch(chartUrl)
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta

    if (!meta) {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    return NextResponse.json({
        marketCap: 0, 
        peRatio: 0,   
        high52: meta.fiftyTwoWeekHigh || 0,
        low52: meta.fiftyTwoWeekLow || 0,
        divYield: 0,
        currency: meta.currency || 'INR',
        symbol: meta.symbol || cleanTicker
    })

  } catch (error: any) {
    console.error("Quote Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}