// app/api/analyze/route.ts
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
  try {
    const { portfolioData } = await request.json()

    if (!portfolioData) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    // 1. Construct a Sophisticated Prompt
    const prompt = `
      You are "PortfolioOS AI," a Senior Investment Strategist specializing in the Indian Equity & Commodity markets. 
      Your job is to ruthlessly but constructively critique the user's portfolio.

      --- PORTFOLIO DATA ---
      Total Net Worth: ₹${portfolioData.totalValue}
      Total Profit: ₹${portfolioData.totalProfit}
      XIRR (Annualized Return): ${portfolioData.xirr}%
      
      Top Sectors Allocation: 
      ${JSON.stringify(portfolioData.sectors)}

      Top Holdings:
      ${JSON.stringify(portfolioData.holdings)}
      -----------------------

      --- INSTRUCTIONS ---
      Analyze the data above and generate a report in **HTML format** (do not use Markdown blocks, just raw HTML string).
      Use Tailwind CSS classes for styling where appropriate (e.g., text-green-600 for good things, text-red-600 for risks).
      
      The report must have these 4 specific sections:

      1. <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">🎯 The Verdict</h3>
         - Give the portfolio a Grade (A+, A, B, C, etc.) and a 1-sentence summary title.
         - Explain the XIRR context (e.g., "Beating FD rates" or "Aggressive Growth").

      2. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">⚠️ Risk Radar</h3>
         - Analyze Concentration Risk: Is one stock or sector taking up >30% of the portfolio?
         - Diversification Check: Are they balanced between Equity/Commodity? (Infer from the provided data).

      3. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🛡️ Sector Health</h3>
         - Comment on their top sector exposure. Is it a cyclical sector (like Metals) or defensive (like FMCG)?

      4. <h3 class="text-lg font-bold text-slate-800 dark:text-white mt-4 mb-2">🚀 Actionable Move</h3>
         - Suggest ONE concrete thing they could consider doing (e.g., "Trim profits in X," "Add more Gold for stability," etc.).

      Keep the tone professional, insightful, yet easy to read. Do not be generic.
    `

    // 2. Call Gemini
    // Using "gemini-pro" or "gemini-1.5-flash" for better reasoning
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })
    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text()

    // Cleanup: Remove markdown code blocks if Gemini adds them by mistake
    text = text.replace(/```html/g, '').replace(/```/g, '')

    return NextResponse.json({ analysis: text })

  } catch (error: any) {
    console.error('AI Error:', error)
    return NextResponse.json({ 
        analysis: `
            <h3 class="text-red-500 font-bold">Analysis Failed</h3>
            <p>Could not generate report. Please ensure your GEMINI_API_KEY is correct and you are not hitting rate limits.</p>
        ` 
    })
  }
}