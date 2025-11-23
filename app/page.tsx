// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  // Immediately redirect anyone who lands on '/' to '/auth'
  redirect('/auth')
}