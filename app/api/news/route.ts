import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser()

export async function POST(request: Request) {
  try {
    const { queries } = await request.json()

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // 1. Construct Query
    // We rely on the client to send a balanced list.
    // The "when:2d" filter ensures freshness.
    const safeQueries = queries.slice(0, 40).map(q => `"${q}"`)
    const queryString = safeQueries.join(' OR ')
    const encodedQuery = encodeURIComponent(`${queryString} when:2d`)
    
    // 2. Parallel Fetch (IN + US Editions)
    const [feedIN, feedUS] = await Promise.allSettled([
        parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`),
        parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`)
    ])

    const itemsIN = feedIN.status === 'fulfilled' ? feedIN.value.items : []
    const itemsUS = feedUS.status === 'fulfilled' ? feedUS.value.items : []

    // 3. Merge & Deduplicate
    const allItems = [...itemsIN, ...itemsUS]
    const uniqueItems: any[] = []
    const seenTitles = new Set()

    allItems.forEach(item => {
        const cleanTitle = item.title?.toLowerCase().trim()
        if (cleanTitle && !seenTitles.has(cleanTitle)) {
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

    // 4. Sort by Date
    uniqueItems.sort((a, b) => {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    })

    return NextResponse.json({ items: uniqueItems })

  } catch (error: any) {
    console.error('News Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}