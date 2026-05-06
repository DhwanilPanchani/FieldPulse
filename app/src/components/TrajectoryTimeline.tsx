'use client'

import type { RiskLevel } from '@/lib/types'

const RISK_STYLE: Record<
  RiskLevel,
  { border: string; bg: string; text: string }
> = {
  LOW: { border: 'border-green-500/40', bg: 'bg-green-500/10', text: 'text-green-400' },
  MEDIUM: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  HIGH: { border: 'border-orange-500/40', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  CRITICAL: { border: 'border-red-500/40', bg: 'bg-red-500/10', text: 'text-red-400' },
}

const RATIONALE: Record<RiskLevel, string> = {
  LOW: 'Favorable conditions',
  MEDIUM: 'Watch developing stress',
  HIGH: 'Intervene soon',
  CRITICAL: 'Immediate action',
}

interface StageProps {
  label: string
  level: RiskLevel
  isNow?: boolean
}

function Stage({ label, level, isNow }: StageProps) {
  const s = RISK_STYLE[level]
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <div
        className={`relative rounded-xl border ${s.border} ${s.bg} px-4 py-3 text-center ${
          isNow ? 'ring-1 ring-white/10' : ''
        }`}
      >
        {isNow && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-2 py-px text-[9px] text-white/60">
            NOW
          </div>
        )}
        <span className={`text-sm font-bold ${s.text}`}>{level}</span>
        <p className="mt-0.5 text-[10px] text-gray-500">{RATIONALE[level]}</p>
      </div>
    </div>
  )
}

interface Props {
  current: RiskLevel
  day30: RiskLevel
  day60: RiskLevel
  day90: RiskLevel
}

export default function TrajectoryTimeline({ current, day30, day60, day90 }: Props) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a160a] p-6">
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Risk Trajectory
      </h2>
      <div className="flex items-start justify-between">
        <Stage label="Today" level={current} isNow />
        <div className="mx-2 mt-7 flex-1 border-t border-dashed border-gray-700/60" />
        <Stage label="30 days" level={day30} />
        <div className="mx-2 mt-7 flex-1 border-t border-dashed border-gray-700/60" />
        <Stage label="60 days" level={day60} />
        <div className="mx-2 mt-7 flex-1 border-t border-dashed border-gray-700/60" />
        <Stage label="90 days" level={day90} />
      </div>
    </div>
  )
}
