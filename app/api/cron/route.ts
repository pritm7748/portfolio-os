// app/api/cron/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// IMPORTANT: Initialize Supabase with Service Role Key (to bypass RLS and read all user alerts)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // You need to get this from Supabase Settings > API
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
    // 1. Verify Authorization (Simple Secret to prevent abuse)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        // 2. Fetch ACTIVE alerts
        const { data: alerts, error } = await supabase
            .from('price_alerts')
            .select('*, users:user_id (email)') // Join to get user email
            .is('triggered_at', null)

        if (error || !alerts || alerts.length === 0) return NextResponse.json({ message: 'No active alerts' })

        const triggeredAlerts = []

        // 3. Check Prices
        // Optimize: Get unique tickers to avoid duplicate API calls
        const uniqueTickers = [...new Set(alerts.map(a => a.ticker))]
        
        // Call our own internal Price API to get latest prices
        // (In a real cron job, you might call Yahoo directly to avoid self-loop, but this works for Vercel)
        const priceRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/prices`, {
            method: 'POST',
            body: JSON.stringify({ tickers: uniqueTickers })
        })
        const priceMap = await priceRes.json()

        // 4. Evaluate Logic
        for (const alert of alerts) {
            const currentPrice = priceMap[alert.ticker]
            if (!currentPrice) continue

            let isTriggered = false
            if (alert.condition === 'above' && currentPrice >= alert.target_price) isTriggered = true
            if (alert.condition === 'below' && currentPrice <= alert.target_price) isTriggered = true

            if (isTriggered) {
                triggeredAlerts.push(alert)

                // A. Send Email
                await resend.emails.send({
                    from: 'PortfolioOS <onboarding@resend.dev>',
                    to: [alert.users.email], // The user's email
                    subject: `🔔 Alert Triggered: ${alert.ticker}`,
                    html: `
                        <h1>Price Alert Triggered!</h1>
                        <p><strong>${alert.ticker}</strong> has crossed your target.</p>
                        <p>Target: ₹${alert.target_price}</p>
                        <p>Current Price: <strong>₹${currentPrice}</strong></p>
                        <br/>
                        <a href="https://your-app-url.vercel.app/dashboard/alerts">View in Dashboard</a>
                    `
                })

                // B. Mark as Triggered in DB
                await supabase
                    .from('price_alerts')
                    .update({ triggered_at: new Date().toISOString() })
                    .eq('id', alert.id)
            }
        }

        return NextResponse.json({ 
            message: 'Cron job ran successfully', 
            checks: alerts.length, 
            triggered: triggeredAlerts.length 
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}