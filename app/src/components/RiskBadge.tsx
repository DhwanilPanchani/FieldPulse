'use client'

import type { RiskLevel } from '@/lib/types'

const RISK_CONFIG: Record<
  RiskLevel,
  { color: string; bg: string; border: string; bar: string; icon: string; label: string }
> = {
  LOW: {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    bar: 'bg-green-500',
    icon: '✅',
    label: 'Low Risk',
  },
  MEDIUM: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    bar: 'bg-amber-500',
    icon: '⚠️',
    label: 'Moderate Risk',
  },
  HIGH: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    bar: 'bg-orange-500',
    icon: '🔴',
    label: 'High Risk',
  },
  CRITICAL: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    bar: 'bg-red-500',
    icon: '🚨',
    label: 'Critical Risk',
  },
}

interface Props {
  level: RiskLevel
  score: number
  locationName: string
  analyzedAt: string
}

export default function RiskBadge({ level, score, locationName, analyzedAt }: Props) {
  const cfg = RISK_CONFIG[level]
  const date = new Date(analyzedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-8`}>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* Circular score gauge */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className={cfg.color}
              style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${cfg.color}`}>{score}</span>
            <span className="text-xs text-gray-500">/ 100</span>
          </div>
        </div>

        {/* Risk info */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="text-2xl">{cfg.icon}</span>
            <span className={`text-3xl font-black ${cfg.color}`}>{cfg.label}</span>
          </div>
          <p className="mt-1 text-sm text-gray-400">{locationName}</p>
          <p className="mt-0.5 text-xs text-gray-600">{date}</p>

          {/* Score bar */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${cfg.bar}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-600">
            <span>Low risk</span>
            <span>Critical</span>
          </div>
        </div>
      </div>
    </div>
  )
}
