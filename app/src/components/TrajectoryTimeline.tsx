'use client'

import { RISK_COLORS, type RiskLevel } from '@/lib/types'

const RATIONALE: Record<RiskLevel, string> = {
  LOW: 'Favorable conditions',
  MEDIUM: 'Watch developing stress',
  HIGH: 'Active stress — intervene soon',
  CRITICAL: 'Immediate action required',
}

interface Props {
  current: RiskLevel
  day30: RiskLevel
  day60: RiskLevel
  day90: RiskLevel
}

function Box({ label, level }: { label: string; level: RiskLevel }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex min-w-[80px] flex-col items-center rounded-xl px-3 py-3 text-center font-bold text-white shadow"
        style={{ backgroundColor: RISK_COLORS[level] }}
      >
        <span className="text-xs opacity-80">{label}</span>
        <span className="text-sm">{level}</span>
      </div>
      <span className="text-center text-[10px] text-gray-500">{RATIONALE[level]}</span>
    </div>
  )
}

export default function TrajectoryTimeline({ current, day30, day60, day90 }: Props) {
  return (
    <div className="rounded-2xl bg-[#1a1d27] p-6 shadow-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Risk Trajectory
      </h2>
      <div className="flex items-start justify-between gap-1">
        <Box label="Now" level={current} />
        <Arrow />
        <Box label="30 days" level={day30} />
        <Arrow />
        <Box label="60 days" level={day60} />
        <Arrow />
        <Box label="90 days" level={day90} />
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="mt-4 flex-1 text-center text-lg text-gray-600" aria-hidden="true">
      →
    </div>
  )
}
