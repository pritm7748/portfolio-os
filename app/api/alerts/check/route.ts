// app/api/alerts/check/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST() {
  const supabase = await createClient()

  try {
    // 1. Get Current User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Fetch ONLY Active Alerts for this User
    const { data: alerts } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('user_id', user.id)
        .is('triggered_at', null) // Only check non-triggered ones

    if (!alerts || alerts.length === 0) {
        return NextResponse.json({ triggered: 0, message: 'No active alerts' })
    }

    // 3. Fetch Live Prices
    const uniqueTickers = [...new Set(alerts.map(a => a.ticker))]
    // Call our internal prices API
    const priceRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/prices`, {
        method: 'POST',
        body: JSON.stringify({ tickers: uniqueTickers })
    })
    const priceMap = await priceRes.json()

    // 4. Check Logic
    const triggeredAlerts = []

    for (const alert of alerts) {
        const currentPrice = priceMap[alert.ticker]
        if (!currentPrice) continue

        let isTriggered = false
        if (alert.condition === 'above' && currentPrice >= alert.target_price) isTriggered = true
        if (alert.condition === 'below' && currentPrice <= alert.target_price) isTriggered = true

        if (isTriggered) {
            triggeredAlerts.push(alert)

            // A. Mark as Triggered IMMEDIATELY (so we don't spam email)
            await supabase
                .from('price_alerts')
                .update({ triggered_at: new Date().toISOString() })
                .eq('id', alert.id)

            // B. Send Email (Fire and forget)
            try {
                await resend.emails.send({
                    from: 'PortfolioOS <onboarding@resend.dev>',
                    to: [user.email || ''],
                    subject: `🚨 ${alert.ticker} Hit Target: ₹${currentPrice}`,
                    html: `
                        <h2>Price Alert Triggered!</h2>
                        <p><strong>${alert.ticker}</strong> has crossed your target of ₹${alert.target_price}.</p>
                        <p>Current Live Price: <strong>₹${currentPrice}</strong></p>
                        <br/>
                        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/alerts">View Alerts</a>
                    `
                })
            } catch (err) {
                console.error("Email failed", err)
            }
        }
    }

    return NextResponse.json({ 
        triggered: triggeredAlerts.length,
        alerts: triggeredAlerts 
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}