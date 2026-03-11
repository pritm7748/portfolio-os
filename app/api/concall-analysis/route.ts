import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ════════════════════════════════════════════════════════════════
//  /api/concall-analysis — Gemini-powered concall transcript analysis
// ════════════════════════════════════════════════════════════════

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
    try {
        const { ticker, transcriptUrl } = await request.json()
        if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

        // Step 1: If we have a transcript URL, try to fetch it
        let transcriptText = ''
        if (transcriptUrl) {
            try {
                const res = await fetch(transcriptUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                })
                if (res.ok) {
                    const html = await res.text()
                    // Basic HTML-to-text extraction
                    transcriptText = html
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .substring(0, 50000) // Limit for Gemini context
                }
            } catch (e) {
                console.warn('Could not fetch transcript:', e)
            }
        }

        // Step 2: If no transcript available, do web-informed analysis
        const hasTranscript = transcriptText.length > 500

        const prompt = hasTranscript ? `
You are "PortfolioOS AI," a Senior Equity Research Analyst specializing in Indian markets.
Analyze this earnings call transcript for ${ticker} and generate a structured report in **HTML format** using Tailwind CSS classes.

--- TRANSCRIPT ---
${transcriptText}
--- END TRANSCRIPT ---

Generate a report with these sections:

1. <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">📋 Executive Summary</h3>
   - 3-4 bullet points of the most important takeaways

2. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🎯 Revenue & Margin Outlook</h3>
   - Management's guidance on revenue growth
   - Margin trajectory commentary
   - Any specific numbers or targets mentioned

3. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🏗️ Capex & Expansion Plans</h3>
   - New projects, capacity additions, geographic expansion
   - Investment plans and timelines

4. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">⚠️ Risk Factors</h3>
   - Risks mentioned or implied by management
   - Regulatory, competitive, or macro concerns

5. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🐂 Bull Case</h3>
   - Why this stock could outperform (based on management commentary)

6. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🐻 Bear Case</h3>
   - Why this stock could underperform (risks, concerns)

7. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🔑 Key Quotes</h3>
   - 2-3 direct quotes from management that are most impactful

Keep the tone professional and data-driven. Be specific with numbers and metrics.
        ` : `
You are "PortfolioOS AI," a Senior Equity Research Analyst specializing in Indian markets.
No specific transcript is available for ${ticker}. Based on your general knowledge about this company, provide a forward-looking analysis report in **HTML format** using Tailwind CSS classes.

Generate a report with these sections:

1. <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">📋 Company Overview</h3>
   - Brief overview of the company, its business model, and competitive position

2. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🎯 Growth Drivers</h3>
   - Key catalysts that could drive future growth

3. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">⚠️ Key Risks</h3>
   - Major risks facing the company

4. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🐂 Bull Case</h3>
   - Optimistic scenario

5. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🐻 Bear Case</h3>
   - Pessimistic scenario

6. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">📌 Things to Watch</h3>
   - What investors should monitor in upcoming quarters

Note: This analysis is based on general knowledge. For the most accurate forward-looking analysis, the latest concall transcript should be reviewed.
Keep the tone professional. Be specific.
        `

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const result = await model.generateContent(prompt)
        const response = await result.response
        let text = response.text()
        text = text.replace(/```html/g, '').replace(/```/g, '')

        return NextResponse.json({
            analysis: text,
            hasTranscript,
            ticker
        })

    } catch (error: any) {
        console.error('Concall Analysis Error:', error)
        return NextResponse.json({
            analysis: `
                <h3 class="text-red-500 font-bold">Analysis Failed</h3>
                <p class="text-slate-500 text-sm">Could not generate report. ${error.message}</p>
            `,
            hasTranscript: false,
            ticker: ''
        })
    }
}
