// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // This is the success URL.
      // We will create the '/dashboard' page next.
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // return the user to an error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}