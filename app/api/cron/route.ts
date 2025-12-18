import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function GET(request: Request) {
  // 1. Security Check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN is missing")
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 })
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
    
    // Self-call to reuse your existing price logic
    const priceRes = await fetch(`${appUrl}/api/prices`, {
        method: 'POST',
        body: JSON.stringify({ tickers: uniqueTickers })
    })
    const priceMap = await priceRes.json()

    const triggeredList = []
    const logs = []

    // 4. Check Logic
    for (const alert of alerts) {
      const currentPrice = priceMap[alert.ticker]
      if (!currentPrice) continue

      let isTriggered = false
      if (alert.condition === 'above' && currentPrice >= alert.target_price) isTriggered = true
      if (alert.condition === 'below' && currentPrice <= alert.target_price) isTriggered = true

      if (isTriggered) {
        // 5. Fetch User Profile to get Chat ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('telegram_chat_id')
            .eq('id', alert.user_id)
            .single()
        
        // Only send if user has configured Telegram
        // @ts-ignore
        if (profile && profile.telegram_chat_id) {
            
            const message = `
🚨 <b>Price Alert: ${alert.ticker}</b>

Asset has moved <b>${alert.condition}</b> your target.

🎯 Target: <b>₹${alert.target_price.toLocaleString('en-IN')}</b>
💰 Current: <b>₹${currentPrice.toLocaleString('en-IN')}</b>

<i>Check your portfolio for details.</i>
            `

            // 6. Send Telegram Message
            try {
                const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        // @ts-ignore
                        chat_id: profile.telegram_chat_id,
                        text: message,
                        parse_mode: 'HTML'
                    })
                })

                if (tgRes.ok) {
                    logs.push({ id: alert.id, status: 'sent', channel: 'telegram' })
                    
                    // 7. Mark as Triggered
                    await supabase
                      .from('price_alerts')
                      .update({ triggered_at: new Date().toISOString() })
                      .eq('id', alert.id)
                    
                    triggeredList.push(alert.id)
                } else {
                    const err = await tgRes.json()
                    console.error("Telegram API Error:", err)
                    logs.push({ id: alert.id, status: 'failed', error: err })
                }
            } catch (e) {
                console.error("Fetch Error:", e)
            }
        } else {
            logs.push({ id: alert.id, status: 'skipped', reason: 'No Chat ID found' })
        }
      }
    }

    return NextResponse.json({ 
        success: true, 
        triggered: triggeredList.length, 
        details: logs 
    })

  } catch (error: any) {
    console.error("Cron Job Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}