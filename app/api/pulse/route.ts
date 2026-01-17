import { NextResponse } from 'next/server'

// --- 1. GOOGLE FINANCE MAPPING ---
// Google uses different symbols than Yahoo. We map them here.
const MACRO_MAP: Record<string, any> = {
    'INR=X': { gf: 'USD-INR', name: 'USD/INR', type: 'Currency', prefix: '₹', suffix: '' },
    'CL=F':  { gf: 'BRENT',   name: 'Brent Crude', type: 'Commodity', prefix: '$', suffix: '' },
    'GC=F':  { gf: 'GCW00',   name: 'Gold (Fut)', type: 'Commodity', prefix: '$', suffix: '' }, // GCW00 is Gold Futures
    '^TNX':  { gf: 'US10Y',   name: 'US 10Y Yield', type: 'Bond', prefix: '', suffix: '%' }
}

// --- 2. HELPER: SCRAPE GOOGLE FINANCE ---
async function scrapeGoogleFinance(symbol: string, isMacro = false) {
    try {
        // Transform Ticker: "RELIANCE.NS" -> "RELIANCE:NSE"
        let gfSymbol = symbol
        if (!isMacro) {
            gfSymbol = symbol.replace('.NS', ':NSE').replace('.BO', ':BOM')
        }

        const url = `https://www.google.com/finance/quote/${gfSymbol}`
        
        const res = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            next: { revalidate: 0 }
        })
        
        const html = await res.text()

        // --- REGEX EXTRACTION (Fast & dependency-free) ---
        // 1. Price: Look for the specific class Google uses for current price
        // Class "YMlKec fxKbKc" is standard for the big price number on Google Finance
        const priceMatch = html.match(/<div class="YMlKec fxKbKc">([^<]+)<\/div>/)
        const priceStr = priceMatch ? priceMatch[1].replace(/[^0-9.-]+/g, '') : '0'
        
        // 2. Change %: Look for the percentage pill
        // Class often starts with "Ch11Rf" (Positive) or "N2Bl y" (Negative) - this changes often, so we look for patterns
        const changeMatch = html.match(/<div class="[^"]*?badge[^"]*?">([+-]?[0-9.]+)%<\/div>/) || 
                            html.match(/<span class="[^"]*?pct[^"]*?">([+-]?[0-9.]+)%<\/span>/) ||
                            // Fallback: finding the first percentage after the price
                            html.match(/[+-][0-9]+\.[0-9]+%/) 

        let changeStr = '0'
        if (changeMatch) {
            changeStr = changeMatch[0].replace(/<[^>]*>/g, '').replace('%', '')
        }

        // 3. Volume (For Big Money Radar)
        // Look for "Volume" label and get the following value
        // This is brittle on Google, so we might skip strict volume checks if failing
        const volMatch = html.match(/Volume<\/div><div class="[^"]*?">([^<]+)<\/div>/)
        let volume = 0
        if (volMatch) {
            const v = volMatch[1].toUpperCase()
            if (v.includes('M')) volume = parseFloat(v) * 1000000
            else if (v.includes('K')) volume = parseFloat(v) * 1000
            else if (v.includes('B')) volume = parseFloat(v) * 1000000000
            else volume = parseFloat(v.replace(/,/g, ''))
        }

        return {
            symbol,
            price: parseFloat(priceStr),
            change: parseFloat(changeStr),
            volume
        }

    } catch (e) {
        console.error(`Error scraping ${symbol}:`, e)
        return null
    }
}

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json()
    
    const uniqueTickers = Array.from(new Set((tickers || []) as string[]))
    const holdings = uniqueTickers.map((t) => {
         let clean = t.toUpperCase().trim()
         if (!clean.includes('.') && !clean.includes('^') && !clean.includes('=')) {
             clean += '.NS'
         }
         return clean
    })

    const macro: any[] = []
    const shockers: any[] = []
    
    // --- 1. FETCH MACRO DATA ---
    // Process sequentially to be gentle
    for (const [yahooTicker, config] of Object.entries(MACRO_MAP)) {
        const data = await scrapeGoogleFinance(config.gf, true)
        if (data) {
            macro.push({
                name: config.name,
                price: data.price,
                change: data.change,
                type: config.type,
                prefix: config.prefix,
                suffix: config.suffix
            })
        }
        // Tiny delay
        await new Promise(r => setTimeout(r, 200))
    }

    // --- 2. FETCH HOLDINGS (For Volume Radar) ---
    // Google Finance is stricter than Yahoo, so we limit how many we scan.
    // We'll scan the top 10 tickers to avoid getting IP banned.
    const scanList = holdings.slice(0, 10) 

    for (const ticker of scanList) {
        const data = await scrapeGoogleFinance(ticker, false)
        if (data && data.volume > 0) {
            // Rough logic: If volume > 50M or Change > 5%, highlight it
            // (Since we can't easily get Avg Volume from Google HTML without complex parsing)
            if (Math.abs(data.change) > 3.0) {
                shockers.push({
                    ticker: ticker.replace('.NS', ''),
                    volume: data.volume,
                    avgVolume: 0, // Not available easily
                    ratio: Math.abs(data.change).toFixed(1) + '%', // Showing Change instead of Vol Ratio
                    change: data.change
                })
            }
        }
        await new Promise(r => setTimeout(r, 500))
    }

    // --- 3. RETURN DATA ---
    // Note: Insiders & Events are empty because Google Finance doesn't provide them easily.
    return NextResponse.json({ 
        events: [], 
        insiders: [], 
        shockers, 
        macro 
    })

  } catch (error: any) {
    console.error("Pulse API Error:", error)
    return NextResponse.json({ events: [], insiders: [], shockers: [], macro: [], error: error.message })
  }
}