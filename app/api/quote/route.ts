import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // 1. Handle Commodities (No fundamentals available)
    if (cleanTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 

    // 2. Detect if it's an Indian Stock
    // If it ends in .NS, .BO or has no suffix, we assume Indian and try Screener.in
    const isIndian = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') || (!cleanTicker.includes('.') && !cleanTicker.includes('^'))
    
    if (isIndian) {
        // Remove suffix for Screener (TCS.NS -> TCS)
        const symbol = cleanTicker.split('.')[0]
        
        try {
            // Fetch Screener Page
            const screenerUrl = `https://www.screener.in/company/${symbol}/`
            const res = await fetch(screenerUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                next: { revalidate: 300 } // Cache for 5 minutes
            })
            
            if (res.ok) {
                const html = await res.text()
                const $ = cheerio.load(html)
                
                // Helper to extract value by name from the top list
                // Screener structure: <li class="flex flex-space-between"> <span class="name">Market Cap</span> <span class="nowrap value"> <span class="number">12,34,567</span> </span> </li>
                const getData = (name: string) => {
                    // Look for the list item containing the text
                    // This is a robust search that looks for the specific label text
                    const el = $(`li:contains("${name}") .value`)
                    const text = el.text().trim().replace(/,/g, '') // Remove commas
                    return parseFloat(text) || 0
                }

                // Extract Data
                const marketCap = getData('Market Cap')
                const peRatio = getData('Stock P/E')
                const high = getData('High')
                const low = getData('Low')
                const divYield = getData('Dividend Yield')

                // If we found valid data, return it immediately
                if (marketCap > 0) {
                    return NextResponse.json({
                        // Screener gives Market Cap in Crores. 
                        // We return the raw number (e.g. 1500000). 
                        // Your UI formatter handles "Cr" label if needed, or we pass it as is.
                        // Let's standardize: Return raw number.
                        marketCap: marketCap * 10000000, // Convert Crores to absolute value if your UI expects full number
                        peRatio: peRatio,
                        high52: high,
                        low52: low,
                        divYield: divYield / 100, // Convert 1.5 to 0.015 for % logic
                        currency: 'INR',
                        symbol: symbol
                    })
                }
            }
        } catch (err) {
            console.warn(`Screener fetch failed for ${symbol}, falling back...`, err)
        }
    }

    // 3. FALLBACK: Yahoo Finance (Chart API)
    // If Screener failed (or it's a US Stock), use the Chart API.
    // It won't have P/E, but it will have High/Low/Price so the UI doesn't break.
    
    if (!cleanTicker.includes('.') && !cleanTicker.includes('^')) cleanTicker += '.NS'

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?interval=1d&range=1d`
    const res = await fetch(chartUrl)
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta

    if (!meta) {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
    }

    return NextResponse.json({
        marketCap: 0, // Not available in Chart API
        peRatio: 0,   // Not available in Chart API
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