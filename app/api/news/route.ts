import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser()

export async function POST(request: Request) {
  try {
    const { queries } = await request.json()

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // --- STRATEGY: BATCH PROCESSING ---
    // We split the list into chunks of 10.
    // This ensures Google respects the 'when:2d' filter for every topic 
    // and prevents "loud" topics (like Nifty) from drowning out "quiet" ones (like Silver).
    const BATCH_SIZE = 10
    const batches = []
    
    // 1. Create Batches
    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
        batches.push(queries.slice(i, i + BATCH_SIZE))
    }

    // 2. Fetch All Batches in Parallel
    const batchResults = await Promise.all(batches.map(async (batch) => {
        const safeQueries = batch.map((q: string) => `"${q}"`)
        const queryString = safeQueries.join(' OR ')
        
        // ADD 'scoring=n' -> Forces "Newest" sort order from Google
        // ADD 'when:2d'   -> Strict 48-hour window
        const encodedQuery = encodeURIComponent(`${queryString} when:2d`)
        
        // Fetch both Editions for this specific batch
        const [resIN, resUS] = await Promise.allSettled([
            parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en&scoring=n`),
            parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en&scoring=n`)
        ])

        const items = []
        if (resIN.status === 'fulfilled') items.push(...resIN.value.items)
        if (resUS.status === 'fulfilled') items.push(...resUS.value.items)
        
        return items
    }))

    // 3. Flatten Results
    const allItems = batchResults.flat()

    // 4. Merge & Deduplicate
    const uniqueItems: any[] = []
    const seenTitles = new Set()

    allItems.forEach(item => {
        const cleanTitle = item.title?.toLowerCase().trim()
        
        // Filter out obviously old news if the RSS feed leaks it
        const itemDate = item.pubDate ? new Date(item.pubDate) : new Date()
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
        
        if (cleanTitle && !seenTitles.has(cleanTitle) && itemDate > twoDaysAgo) {
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

    // 5. Final Sort by Date (Newest First)
    uniqueItems.sort((a, b) => {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    })

    return NextResponse.json({ items: uniqueItems })

  } catch (error: any) {
    console.error('News Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}