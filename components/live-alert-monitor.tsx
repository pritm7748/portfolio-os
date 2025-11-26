// components/live-alert-monitor.tsx
'use client'

import { useEffect } from 'react'
import { toast } from 'sonner' // We will install this for nice popups

export default function LiveAlertMonitor() {
  useEffect(() => {
    // Function to run the check
    const checkAlerts = async () => {
      try {
        const res = await fetch('/api/alerts/check', { method: 'POST' })
        const data = await res.json()

        if (data.triggered > 0) {
            // Show a browser notification/toast
            data.alerts.forEach((alert: any) => {
                // Native Browser Notification (if supported/allowed)
                if (Notification.permission === "granted") {
                    new Notification(`Price Alert: ${alert.ticker}`, {
                        body: `Target Hit! Price crossed ₹${alert.target_price}`
                    })
                }
                // Play a subtle sound
                const audio = new Audio('/notification.mp3') // You can add a sound file later
                audio.play().catch(() => {}) 
            })
            
            // Force Refresh the page data if needed
            window.location.reload()
        }
      } catch (e) {
        console.error("Background alert check failed", e)
      }
    }

    // 1. Request Notification Permission on mount
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission()
    }

    // 2. Run immediately on mount
    checkAlerts()

    // 3. Run every 60 seconds
    const interval = setInterval(checkAlerts, 60000)

    return () => clearInterval(interval)
  }, [])

  return null // Invisible component
}