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
    // Increased limit to 30 to cover both Indian & Global topics
    const safeQueries = queries.slice(0, 30).map(q => `"${q}"`)
    const queryString = safeQueries.join(' OR ')
    
    // 2. Fetch from Google News (Global/US Edition)
    // We use US edition to ensure we get Fed/Global Commodities/Geopolitics
    // Indian topics will still work because "RBI" or "Sensex" are unique keywords
    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryString)} when:2d&hl=en-US&gl=US&ceid=US:en`
    
    const feed = await parser.parseURL(feedUrl)

    // 3. Clean & Sort Data
    const items = feed.items.map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: item.contentSnippet || item.creator || 'Google News',
      sourceName: item.title?.split(' - ').pop() || 'News'
    }))

    return NextResponse.json({ items })

  } catch (error: any) {
    console.error('News Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}