import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // 1. Skip Commodities
    if (cleanTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 

    // 2. Standardize Ticker for Indian Context
    const isIndian = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') || (!cleanTicker.includes('.') && !cleanTicker.includes('^'))
    
    if (isIndian) {
        const symbol = cleanTicker.split('.')[0] // e.g. TCS
        
        try {
            const screenerUrl = `https://www.screener.in/company/${symbol}/`
            const res = await fetch(screenerUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                next: { revalidate: 300 } // Cache 5 mins
            })
            
            if (res.ok) {
                const html = await res.text()
                const $ = cheerio.load(html)
                
                let marketCap = 0
                let peRatio = 0
                let high52 = 0
                let low52 = 0
                let divYield = 0

                // Smart Parse Loop
                $('#top-ratios li').each((_, el) => {
                    const name = $(el).find('.name').text().trim().toLowerCase()
                    const valueText = $(el).find('.value').text().trim()
                    
                    // CLEANER FUNCTION: Removes commas, 'Cr', '%' etc. Keeps only digits and decimals.
                    const cleanNumber = (str: string) => parseFloat(str.replace(/[^\d.]/g, '')) || 0

                    if (name.includes('market cap')) {
                        // Screener: "14,50,000 Cr" -> 1450000
                        // We convert to absolute: 1450000 * 1 Crore
                        marketCap = cleanNumber(valueText) * 10000000
                    } 
                    else if (name.includes('stock p/e')) {
                        peRatio = cleanNumber(valueText)
                    } 
                    else if (name.includes('dividend yield')) {
                        divYield = cleanNumber(valueText) / 100
                    } 
                    else if (name.includes('high') && name.includes('low')) {
                        // Format: "4500 / 3200"
                        const parts = valueText.split('/')
                        if (parts.length === 2) {
                            high52 = cleanNumber(parts[0])
                            low52 = cleanNumber(parts[1])
                        }
                    }
                })

                if (marketCap > 0) {
                    return NextResponse.json({
                        marketCap,
                        peRatio,
                        high52,
                        low52,
                        divYield,
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
    // If Screener failed (or it's a US Stock), use Chart API as backup.
    
    if (!cleanTicker.includes('.') && !cleanTicker.includes('^')) cleanTicker += '.NS'

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?interval=1d&range=1d`
    const res = await fetch(chartUrl, { next: { revalidate: 300 } })
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta

    if (!meta) {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    return NextResponse.json({
        marketCap: meta.marketCap || 0, 
        peRatio: 0, // Not available in Chart API
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