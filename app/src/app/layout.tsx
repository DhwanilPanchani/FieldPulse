import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FieldPulse — Agricultural Risk Intelligence',
  description:
    'Free early-warning system for crop failure risk. Real satellite, weather, and soil data for smallholder farmers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
