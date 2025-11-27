// app/api/cron/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Initialize Admin Supabase Client (Bypasses RLS to check all users' alerts)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  // 1. Secure this route (So random people can't spam it)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // 2. Fetch ALL Active Alerts (where triggered_at is null)
    const { data: alerts, error } = await supabase
      .from('price_alerts')
      .select('*')
      .is('triggered_at', null)

    if (error || !alerts || alerts.length === 0) {
      return NextResponse.json({ message: 'No active alerts to check' })
    }

    // 3. Get Live Prices for these tickers
    // We collect unique tickers to minimize API calls
    const uniqueTickers = [...new Set(alerts.map(a => a.ticker))]
    
    // Reuse our existing price fetching logic (calling Yahoo directly here for speed)
    // NOTE: In production, you might abstract the fetchYahooPrice function to a shared lib file
    // For now, we fetch internal API or just create a helper here. 
    // Let's call our internal API to keep it DRY:
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const priceRes = await fetch(`${appUrl}/api/prices`, {
        method: 'POST',
        body: JSON.stringify({ tickers: uniqueTickers })
    })
    const priceMap = await priceRes.json()

    const triggeredList = []

    // 4. Check Conditions
    for (const alert of alerts) {
      const currentPrice = priceMap[alert.ticker]
      if (!currentPrice) continue

      let isTriggered = false
      if (alert.condition === 'above' && currentPrice >= alert.target_price) isTriggered = true
      if (alert.condition === 'below' && currentPrice <= alert.target_price) isTriggered = true

      if (isTriggered) {
        // 5. Fetch User Email (Since we only have user_id)
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(alert.user_id)
        
        if (user && user.email) {
            // 6. Send Email
            await resend.emails.send({
              from: 'PortfolioOS <onboarding@resend.dev>',
              to: user.email,
              subject: `🔔 Alert Triggered: ${alert.ticker}`,
              html: `
                <h1>Price Target Hit!</h1>
                <p><strong>${alert.ticker}</strong> has reached <strong>₹${currentPrice}</strong>.</p>
                <p>Your target was: ${alert.condition} ₹${alert.target_price}</p>
                <p>Time: ${new Date().toLocaleString()}</p>
              `
            })

            // 7. Mark Alert as Triggered in DB
            await supabase
              .from('price_alerts')
              .update({ triggered_at: new Date().toISOString() })
              .eq('id', alert.id)
            
            triggeredList.push(alert.id)
        }
      }
    }

    return NextResponse.json({ success: true, triggered: triggeredList })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}