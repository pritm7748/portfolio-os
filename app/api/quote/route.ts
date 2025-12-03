import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: Request) {
  try {
    const { ticker } = await request.json()
    if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

    let cleanTicker = ticker.toUpperCase().replace(/\s/g, '')
    
    // 1. Skip Commodities (Return hardcoded sector)
    if (cleanTicker.startsWith('COMMODITY:')) {
         return NextResponse.json({ 
             marketCap: 0, peRatio: 0, high52: 0, low52: 0, divYield: 0, currency: 'INR', symbol: cleanTicker,
             sector: 'Commodities', industry: 'Commodities' 
         })
    } 

    // 2. Prepare Tickers
    // Screener needs "TCS"
    // Yahoo needs "TCS.NS"
    let screenerTicker = cleanTicker.split('.')[0]
    let yahooTicker = cleanTicker
    
    // Heuristic: If it looks like an Indian stock but has no extension, add .NS for Yahoo
    const isIndian = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') || (!cleanTicker.includes('.') && !cleanTicker.includes('^'))
    if (isIndian) {
        if (!yahooTicker.includes('.') && !yahooTicker.includes('^')) yahooTicker += '.NS'
    }

    // 3. PARALLEL FETCHING
    // We fetch Fundamentals (Screener) AND Profile (Yahoo) at the same time
    const [screenerRes, yahooRes] = await Promise.all([
        // A. Screener Fetch (Only if Indian)
        isIndian ? fetch(`https://www.screener.in/company/${screenerTicker}/`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 300 }
        }).then(res => res.text()).catch(e => null) : Promise.resolve(null),

        // B. Yahoo Profile Fetch (For Sector & Industry)
        fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=assetProfile,price`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 86400 } // Cache 24h
        }).then(res => res.json()).catch(e => null)
    ])

    // --- PROCESS DATA ---
    let marketCap = 0, peRatio = 0, high52 = 0, low52 = 0, divYield = 0
    let sector = 'Unknown', industry = 'Unknown'
    let symbol = cleanTicker
    let currency = 'INR'

    // A. Parse Screener (Priority for Fundamentals)
    if (screenerRes) {
        const $ = cheerio.load(screenerRes)
        $('#top-ratios li').each((_, el) => {
            const name = $(el).find('.name').text().trim().toLowerCase()
            const valueText = $(el).find('.value').text().trim()
            const cleanNumber = (str: string) => parseFloat(str.replace(/[^\d.]/g, '')) || 0

            if (name.includes('market cap')) marketCap = cleanNumber(valueText) * 10000000
            else if (name.includes('stock p/e')) peRatio = cleanNumber(valueText)
            else if (name.includes('dividend yield')) divYield = cleanNumber(valueText) / 100
            else if (name.includes('high') && name.includes('low')) {
                const parts = valueText.split('/')
                if (parts.length === 2) {
                    high52 = cleanNumber(parts[0]); low52 = cleanNumber(parts[1])
                }
            }
        })
    }

    // B. Parse Yahoo (Priority for Sector/Industry)
    if (yahooRes?.quoteSummary?.result?.[0]) {
        const result = yahooRes.quoteSummary.result[0]
        
        // Extract Sector
        if (result.assetProfile) {
            sector = result.assetProfile.sector || 'Unknown'
            industry = result.assetProfile.industry || 'Unknown'
        }

        // Fallback Fundamentals (If Screener failed or it's a US stock)
        if (marketCap === 0 && result.price) {
            marketCap = result.price.marketCap?.raw || 0
            currency = result.price.currency || 'INR'
            symbol = result.price.symbol || symbol
        }
    }

    // 4. Return Combined Data
    // Note: If no data found at all, we still return the structure with 0s/Unknowns
    // to allow the UI to handle it gracefully rather than crashing.
    return NextResponse.json({
        marketCap, peRatio, high52, low52, divYield,
        currency,
        symbol,
        sector,   // <--- Now populated from Yahoo
        industry  // <--- Now populated from Yahoo
    })

  } catch (error: any) {
    console.error("Quote Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}