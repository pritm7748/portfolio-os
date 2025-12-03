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
    // We join terms with OR to get a mixed feed
    // Limit to 15 terms max to prevent URL overflow errors
    const safeQueries = queries.slice(0, 15).map(q => `"${q}"`)
    const queryString = safeQueries.join(' OR ')
    
    // 2. Fetch from Google News (India Edition)
    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryString)} when:2d&hl=en-IN&gl=IN&ceid=IN:en`
    
    const feed = await parser.parseURL(feedUrl)

    // 3. Clean & Sort Data
    const items = feed.items.map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: item.contentSnippet || item.creator || 'Google News',
      // Extract Clean Source Name if possible (usually at end of title)
      sourceName: item.title?.split(' - ').pop() || 'News'
    }))

    return NextResponse.json({ items })

  } catch (error: any) {
    console.error('News Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}