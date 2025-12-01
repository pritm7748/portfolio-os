import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // 1. Handle Commodities (No fundamentals)
    if (cleanTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ error: 'Commodity fundamentals not supported' }, { status: 404 })
    } 

    // 2. Detect Indian Stock
    const isIndian = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') || (!cleanTicker.includes('.') && !cleanTicker.includes('^'))
    
    if (isIndian) {
        // Remove suffix for Screener (TCS.NS -> TCS)
        const symbol = cleanTicker.split('.')[0]
        
        try {
            const screenerUrl = `https://www.screener.in/company/${symbol}/`
            const res = await fetch(screenerUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                next: { revalidate: 300 } // Cache for 5 mins
            })
            
            if (res.ok) {
                const html = await res.text()
                const $ = cheerio.load(html)
                
                // Data container
                const data: Record<string, string> = {}

                // Loop through the #top-ratios list seen in your screenshot
                $('#top-ratios li').each((_, el) => {
                    const name = $(el).find('.name').text().trim()
                    const value = $(el).find('.value').text().trim()
                    data[name] = value
                })

                // Helper to parse numbers (removes commas, %, Cr, etc.)
                const parseVal = (key: string) => {
                    const val = data[key]
                    if (!val) return 0
                    // Remove non-numeric chars except dot and slash (for High/Low)
                    return parseFloat(val.replace(/,/g, '').replace(/[^\d./]/g, ''))
                }

                // Extract Fields
                const marketCapRaw = parseVal('Market Cap') // Returns e.g. 1518348 (Cr implied)
                const peRatio = parseVal('Stock P/E')
                const divYield = parseVal('Dividend Yield')
                
                // Handle "High / Low" (e.g. "4586 / 3661")
                let high52 = 0, low52 = 0
                if (data['High / Low']) {
                    const parts = data['High / Low'].split('/')
                    if (parts.length === 2) {
                        high52 = parseFloat(parts[0].replace(/,/g, ''))
                        low52 = parseFloat(parts[1].replace(/,/g, ''))
                    }
                }

                // If we found valid data, return it
                if (marketCapRaw > 0) {
                    return NextResponse.json({
                        // Convert "Cr" to full number for consistency with Yahoo data structure
                        // Your screenshot shows "15,18,348", which is in Crores.
                        // 15,18,348 Cr = 15,18,348 * 1,00,00,000
                        marketCap: marketCapRaw * 10000000, 
                        peRatio: peRatio,
                        high52: high52,
                        low52: low52,
                        divYield: divYield / 100, // Convert 1.35 to 0.0135
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
    // If Screener failed (e.g. wrong symbol) or it's a US Stock, use the Chart API backup.
    
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