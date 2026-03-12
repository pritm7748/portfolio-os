import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { NseIndia } from 'stock-nse-india'

// ════════════════════════════════════════════════════════════════
//  /api/peer-comparison — Multi-source peer comparison
//  Uses NSE India (price) + Screener.in (fundamentals)
// ════════════════════════════════════════════════════════════════

const nseIndia = new NseIndia()

const safeNum = (v: any, fallback = 0): number => {
    if (v === null || v === undefined) return fallback
    const n = typeof v === 'object' && v.raw !== undefined ? v.raw : Number(v)
    return isNaN(n) ? fallback : n
}

const cleanNum = (str: string): number => {
    if (!str) return 0
    return parseFloat(str.replace(/[^\d.\-]/g, '')) || 0
}

async function fetchPeerData(symbol: string) {
    // Fetch NSE + Screener in parallel for each peer
    const [nseData, screenerData] = await Promise.allSettled([
        // NSE: price + P/E
        nseIndia.getEquityDetails(symbol).catch(() => null),
        // Screener: fundamentals (top ratios)
        fetch(`https://www.screener.in/company/${symbol}/consolidated/`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            next: { revalidate: 600 }
        }).then(async res => {
            if (!res.ok) {
                // Try standalone
                const res2 = await fetch(`https://www.screener.in/company/${symbol}/`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    next: { revalidate: 600 }
                })
                if (!res2.ok) return null
                return cheerio.load(await res2.text())
            }
            return cheerio.load(await res.text())
        }).catch(() => null)
    ])

    const nse = nseData.status === 'fulfilled' ? nseData.value as any : null
    const $ = screenerData.status === 'fulfilled' ? screenerData.value : null

    if (!nse && !$) return null

    // Extract NSE data
    const priceInfo = nse?.priceInfo || {}
    const securityInfo = nse?.securityInfo || {}

    // Extract Screener top ratios
    const ratios: Record<string, number> = {}
    if ($) {
        $('#top-ratios li').toArray().forEach((el) => {
            const name = $(el).find('.name').text().trim().toLowerCase()
            // Use span.number for clean values (avoids duplicate text from .value)
            const numberSpans = $(el).find('span.number')
            const value = cleanNum(numberSpans.first().text().trim())

            if (name.includes('market cap')) ratios.marketCap = value * 10000000
            else if (name.includes('current price')) ratios.currentPrice = value
            else if (name.includes('stock p/e') || name === 'p/e') ratios.pe = value
            else if (name.includes('book value')) ratios.bookValue = value
            else if (name.includes('dividend yield')) ratios.divYield = value
            else if (name.includes('roce')) ratios.roce = value
            else if (name.includes('roe')) ratios.roe = value
            else if (name.includes('price to book') || name.includes('p/b')) ratios.pb = value
        })

        // Compute P/B if not directly available
        if (!ratios.pb && ratios.currentPrice && ratios.bookValue && ratios.bookValue > 0) {
            ratios.pb = +(ratios.currentPrice / ratios.bookValue).toFixed(2)
        }

        // Try ratios table for more data
        const ratiosSection = $('section#ratios')
        if (ratiosSection.length) {
            const table = ratiosSection.find('table').first()
            if (table.length) {
                const headers: string[] = []
                table.find('thead th, thead td').toArray().forEach(th => {
                    const t = $(th).text().trim()
                    if (t) headers.push(t)
                })
                const lastIdx = headers.length - 1
                if (lastIdx >= 0) {
                    table.find('tbody tr').toArray().forEach(tr => {
                        const cells: string[] = []
                        $(tr).find('td').toArray().forEach(td => cells.push($(td).text().trim()))
                        if (cells.length >= 2) {
                            const lbl = cells[0].replace(/\s*\+\s*$/, '').toLowerCase()
                            const val = cleanNum(cells[lastIdx] || '0')
                            if ((lbl.includes('debt to equity') || lbl === 'd/e') && !ratios.debtToEquity) ratios.debtToEquity = val
                            else if ((lbl.includes('operating profit margin') || lbl === 'opm') && !ratios.opm) ratios.opm = val
                            else if ((lbl.includes('net profit margin') || lbl === 'npm') && !ratios.npm) ratios.npm = val
                            else if ((lbl.includes('ev/ebitda') || lbl.includes('enterprise value')) && !ratios.evEbitda) ratios.evEbitda = val
                        }
                    })
                }
            }
        }
    }

    const currentPrice = priceInfo.lastPrice || priceInfo.close || ratios.currentPrice || 0

    return {
        ticker: symbol,
        currentPrice,
        marketCap: ratios.marketCap || 0,
        peRatio: ratios.pe || securityInfo?.pe || 0,
        pbRatio: ratios.pb || 0,
        evEbitda: ratios.evEbitda || 0,
        roe: ratios.roe || 0,
        divYield: ratios.divYield || 0,
        revenueGrowth: 0, // Would need annual P&L parse for each peer
        profitMargin: ratios.npm || 0,
        debtToEquity: ratios.debtToEquity || 0,
    }
}

export async function POST(request: Request) {
    try {
        const { ticker, peers } = await request.json()
        if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

        const allSymbols = [ticker, ...(peers || [])].map((s: string) =>
            s.toUpperCase().replace(/\.NS|\.BO/g, '').replace(/\s/g, '')
        )

        // Fetch all peers in parallel (but limit concurrency to avoid rate limiting)
        const batchSize = 4
        const comparison: any[] = []
        for (let i = 0; i < allSymbols.length; i += batchSize) {
            const batch = allSymbols.slice(i, i + batchSize)
            const results = await Promise.all(batch.map(s => fetchPeerData(s)))
            comparison.push(...results.filter(Boolean))
        }

        return NextResponse.json({ comparison })
    } catch (error: any) {
        console.error('Peer Comparison Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
