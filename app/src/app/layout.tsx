import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'FieldPulse — Agricultural Risk Intelligence',
  description:
    'Free early-warning system for crop failure risk. Real satellite imagery, weather forecasts, and soil data fused into a single risk score. No account required.',
  keywords: ['agricultural risk', 'crop failure', 'NDVI', 'satellite farming', 'drought prediction'],
  openGraph: {
    title: 'FieldPulse — Agricultural Risk Intelligence',
    description: 'Free crop failure risk detection using real satellite, weather, and soil data.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
