'use client'

import { RISK_COLORS, type RiskLevel } from '@/lib/types'

const RISK_EMOJI: Record<RiskLevel, string> = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  CRITICAL: '🔴',
}

interface Props {
  level: RiskLevel
  score: number
  locationName: string
  analyzedAt: string
}

export default function RiskBadge({ level, score, locationName, analyzedAt }: Props) {
  const color = RISK_COLORS[level]
  const date = new Date(analyzedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className="rounded-2xl p-8 text-center text-white shadow-lg"
      style={{ backgroundColor: color }}
    >
      <div className="text-5xl font-black tracking-tight">
        {RISK_EMOJI[level]} {level}
      </div>
      <div className="mt-2 text-3xl font-bold opacity-90">{score}/100</div>
      <div className="mt-4 text-sm opacity-80">
        {locationName} &middot; {date}
      </div>
    </div>
  )
}
