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
    // We limit to 50 terms to maximize coverage
    const safeQueries = queries.slice(0, 50).map(q => `"${q}"`)
    const queryString = safeQueries.join(' OR ')
    
    // 2. Fetch from Google News
    // We explicitly include 'when:2d' INSIDE the encoded query.
    // This forces Google to strictly respect the 48-hour window.
    const strictQuery = `${queryString} when:2d`
    const encodedQuery = encodeURIComponent(strictQuery)
    
    // Use US Edition for Global/Macro coverage, specific keywords handle Indian context
    const feedUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`
    
    const feed = await parser.parseURL(feedUrl)

    // 3. Clean & Sort Data
    const items = feed.items.map(item => ({
      title: item.title,
      link: item.link,
      // FIX: Provide a fallback date string to satisfy TypeScript
      pubDate: item.pubDate || new Date().toISOString(),
      source: item.contentSnippet || item.creator || 'Google News',
      sourceName: item.title?.split(' - ').pop() || 'News'
    }))

    // FIX: Sort by Newest First (Date logic is now safe)
    items.sort((a, b) => {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    })

    return NextResponse.json({ items })

  } catch (error: any) {
    console.error('News Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}