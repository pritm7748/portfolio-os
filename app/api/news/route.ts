import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser()

export async function POST(request: Request) {
  try {
    const { queries } = await request.json()

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // 1. Construct Smart Query
    const safeQueries = queries.slice(0, 150).map(q => `"${q}"`)
    const queryString = safeQueries.join(' OR ')
    
    // STRICT TIME FILTER: "when:2d" (Last 48 hours)
    // We encode it WITH the query to ensure Google respects it
    const strictQuery = `${queryString} when:2d`
    const encodedQuery = encodeURIComponent(strictQuery)
    
    // 2. PARALLEL FETCH: India (Local) + US (Global)
    // This ensures we get "RBI" news from Indian sources AND "Fed/Oil" news from Global sources
    const [feedIN, feedUS] = await Promise.all([
        parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`).catch(() => ({ items: [] })),
        parser.parseURL(`https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`).catch(() => ({ items: [] }))
    ])

    // 3. Merge & Deduplicate
    const allItems = [...feedIN.items, ...feedUS.items]
    const uniqueItems: any[] = []
    const seenTitles = new Set()

    allItems.forEach(item => {
        // Normalize title to check for dupes (ignore case/spacing)
        const cleanTitle = item.title?.toLowerCase().trim()
        if (cleanTitle && !seenTitles.has(cleanTitle)) {
            seenTitles.add(cleanTitle)
            uniqueItems.push({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate || new Date().toISOString(), // Fallback for TS
                source: item.contentSnippet || item.creator || 'Google News',
                sourceName: item.title?.split(' - ').pop() || 'News'
            })
        }
    })

    // 4. Sort by Date (Newest First)
    // Essential because merging two feeds breaks the original sort order
    uniqueItems.sort((a, b) => {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    })

    return NextResponse.json({ items: uniqueItems })

  } catch (error: any) {
    console.error('News Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}