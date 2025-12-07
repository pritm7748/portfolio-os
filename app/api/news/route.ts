import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser()

export async function POST(request: Request) {
  try {
    const { queries } = await request.json()

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // --- STRATEGY: SMALLER BATCHES ---
    // Reduced to 5 to prevent URL overflow and Google blocking the request.
    const BATCH_SIZE = 5
    const batches = []
    
    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
        batches.push(queries.slice(i, i + BATCH_SIZE))
    }

    // 2. Fetch Batches
    const batchResults = await Promise.all(batches.map(async (batch) => {
        const safeQueries = batch.map((q: string) => `"${q}"`)
        const queryString = safeQueries.join(' OR ')
        
        // FIX: Removed 'scoring=n'. It causes empty results for broad queries.
        // We rely on 'when:2d' for freshness and sorting in JS later.
        const encodedQuery = encodeURIComponent(`${queryString} when:2d`)
        
        // Fetch India & US editions
        const [resIN, resUS] = await Promise.allSettled([
            parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`),
            parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`)
        ])

        const items = []
        if (resIN.status === 'fulfilled') items.push(...resIN.value.items)
        if (resUS.status === 'fulfilled') items.push(...resUS.value.items)
        
        return items
    }))

    // 3. Flatten & Deduplicate
    const allItems = batchResults.flat()
    const uniqueItems: any[] = []
    const seenTitles = new Set()

    // Helper: Clean title to remove source suffix (e.g. "... - Times of India")
    const cleanTitleText = (t: string) => t.split(' - ')[0].toLowerCase().trim()

    allItems.forEach(item => {
        if (!item.title) return
        
        const cleanTitle = cleanTitleText(item.title)
        
        // 48-Hour Fallback Check (Client-side enforcement)
        const itemDate = item.pubDate ? new Date(item.pubDate) : new Date()
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
        
        if (!seenTitles.has(cleanTitle) && itemDate > twoDaysAgo) {
            seenTitles.add(cleanTitle)
            uniqueItems.push({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate || new Date().toISOString(),
                source: item.contentSnippet || item.creator || 'Google News',
                sourceName: item.title?.split(' - ').pop() || 'News'
            })
        }
    })

    // 5. Strict Sort by Date (Newest First)
    uniqueItems.sort((a, b) => {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    })

    return NextResponse.json({ items: uniqueItems })

  } catch (error: any) {
    console.error('News Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}