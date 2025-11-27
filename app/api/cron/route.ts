// app/api/cron/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Initialize Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  // 1. Security Check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // 2. Fetch Active Alerts
    const { data: alerts, error } = await supabase
      .from('price_alerts')
      .select('*')
      .is('triggered_at', null)

    if (error) throw error
    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ message: 'No active alerts' })
    }

    // 3. Fetch Live Prices
    const uniqueTickers = [...new Set(alerts.map(a => a.ticker))]
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    const priceRes = await fetch(`${appUrl}/api/prices`, {
        method: 'POST',
        body: JSON.stringify({ tickers: uniqueTickers })
    })
    const priceMap = await priceRes.json()

    const triggeredList = []
    const emailLogs = []

    // 4. Check Logic
    for (const alert of alerts) {
      const currentPrice = priceMap[alert.ticker]
      if (!currentPrice) continue

      let isTriggered = false
      if (alert.condition === 'above' && currentPrice >= alert.target_price) isTriggered = true
      if (alert.condition === 'below' && currentPrice <= alert.target_price) isTriggered = true

      if (isTriggered) {
        // 5. Fetch User Email
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(alert.user_id)
        
        if (user && user.email) {
            console.log(`Attempting to send email to ${user.email} for ${alert.ticker}`)
            
            // 6. Send Email with Error Handling
            const { data: emailData, error: emailError } = await resend.emails.send({
              from: 'PortfolioOS <onboarding@resend.dev>',
              to: user.email, // MUST be your verified email on Free Tier
              subject: `🚨 Alert: ${alert.ticker} is ${alert.condition} target!`,
              html: `
                <h2>Price Alert Triggered</h2>
                <p><strong>${alert.ticker}</strong> has moved ${alert.condition} your target.</p>
                <p>Target: <strong>₹${alert.target_price}</strong></p>
                <p>Current Price: <strong>₹${currentPrice}</strong></p>
                <p>Time: ${new Date().toLocaleString()}</p>
              `
            })

            if (emailError) {
                console.error("Resend Error:", emailError)
                emailLogs.push({ id: alert.id, status: 'failed', error: emailError })
            } else {
                console.log("Email Sent:", emailData)
                emailLogs.push({ id: alert.id, status: 'sent' })
                
                // 7. Mark as Triggered ONLY if email didn't fail completely
                await supabase
                  .from('price_alerts')
                  .update({ triggered_at: new Date().toISOString() })
                  .eq('id', alert.id)
                
                triggeredList.push(alert.id)
            }
        }
      }
    }

    return NextResponse.json({ 
        success: true, 
        triggered: triggeredList.length, 
        details: emailLogs 
    })

  } catch (error: any) {
    console.error("Cron Job Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}