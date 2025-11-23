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

    // 1. Construct the Prompt
    const prompt = `
      You are a professional financial analyst. Analyze this investment portfolio summary and provide 3 brief, actionable insights.
      
      Focus on:
      1. Asset Allocation Balance
      2. Diversification Risks
      3. Performance Analysis
      
      Portfolio Data:
      - Total Value: ₹${portfolioData.totalValue}
      - Total Profit: ₹${portfolioData.totalProfit} (XIRR: ${portfolioData.xirr}%)
      - Sector Allocation: ${JSON.stringify(portfolioData.sectors)}
      - Top 5 Holdings: ${JSON.stringify(portfolioData.holdings)}
      
      Output format:
      Return ONLY valid HTML code (no markdown backticks, no <html> tags).
      Use <h3> for headers and <p> for text.
      Make it concise and professional.
    `

    // 2. Call Gemini (Flash Model is fast & free)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text()

    // Cleanup markdown if Gemini adds it
    text = text.replace(/```html/g, '').replace(/```/g, '')

    return NextResponse.json({ analysis: text })

  } catch (error: any) {
    console.error('AI Error:', error)
    return NextResponse.json({ 
        analysis: `<h3>Analysis Unavailable</h3><p>Please configure your GEMINI_API_KEY in .env.local to enable AI insights.</p>` 
    })
  }
}