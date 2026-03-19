import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ════════════════════════════════════════════════════════════════
//  /api/stock-insights — Gemini-powered company-specific KPIs
//  Takes KPI structure (names, units, periods) from Screener and
//  asks Gemini to fill in real values from public sources.
// ════════════════════════════════════════════════════════════════

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// In-memory cache: ticker → { data, timestamp }
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export async function POST(request: Request) {
    try {
        const { ticker, companyName, kpis, periods, forceRefresh } = await request.json()
        if (!ticker || !kpis?.length || !periods?.length) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Check cache (skip if forceRefresh)
        const cacheKey = `${ticker}-insights-${kpis.length}`
        if (!forceRefresh) {
            const cached = cache.get(cacheKey)
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                return NextResponse.json({ insights: cached.data, cached: true })
            }
        }

        // Build KPI list for the prompt
        const kpiList = kpis.map((k: { name: string; unit: string }, i: number) =>
            `${i + 1}. ${k.name} (${k.unit || 'N/A'})`
        ).join('\n')

        const periodList = periods.join(', ')

        const prompt = `You are a financial data expert on Indian listed companies.

For "${companyName || ticker}" (NSE: ${ticker}), provide historical values for these KPIs from annual reports and investor presentations.

KPIs:
${kpiList}

Periods: ${periodList}

RULES:
- Return ONLY a valid JSON array, no markdown, no fences, no text before/after
- Format: [{"name":"exact KPI name","unit":"unit","values":[{"period":"Mar 2024","value":12.5},...]}]
- Use null for unknown values
- Use bare numbers (11.3 not "11.3%", 300464 not "300,464")
- Match KPI names exactly as given above
- Be accurate — this is shown to investors
- Output compact JSON with no extra whitespace

JSON:`

        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 16384,
            }
        })

        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text()

        // Clean up response — remove markdown fences if present
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

        let insights: any[] = []
        try {
            insights = JSON.parse(text)
        } catch (parseError) {
            // Try to extract JSON array from the response
            const jsonMatch = text.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                insights = JSON.parse(jsonMatch[0])
            } else {
                console.error('Failed to parse Gemini response:', text.substring(0, 500))
                return NextResponse.json({ error: 'Failed to parse AI response', raw: text.substring(0, 500) }, { status: 500 })
            }
        }

        // Validate structure
        insights = insights.filter(item =>
            item && item.name && Array.isArray(item.values)
        ).map(item => ({
            name: item.name,
            unit: item.unit || '',
            values: item.values.filter((v: any) => v && v.period).map((v: any) => ({
                period: v.period,
                value: v.value !== null && v.value !== undefined ? Number(v.value) : null
            }))
        }))

        // Cache the result
        cache.set(cacheKey, { data: insights, timestamp: Date.now() })

        return NextResponse.json({ insights, cached: false })

    } catch (error: any) {
        console.error('Stock Insights Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
