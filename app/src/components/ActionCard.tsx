'use client'

import type { RiskLevel } from '@/lib/types'

const BORDER_COLOR: Record<RiskLevel, string> = {
  LOW: 'border-l-green-500/60',
  MEDIUM: 'border-l-amber-500/60',
  HIGH: 'border-l-orange-500/60',
  CRITICAL: 'border-l-red-500/60',
}

const URGENCY: Record<RiskLevel, { label: string; style: string }> = {
  LOW: { label: 'Monitor', style: 'bg-green-500/10 text-green-400 border-green-500/30' },
  MEDIUM: { label: 'Caution', style: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  HIGH: { label: 'Act Soon', style: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  CRITICAL: { label: 'Urgent', style: 'bg-red-500/10 text-red-400 border-red-500/30' },
}

interface Props {
  action: string
  level: RiskLevel
}

export default function ActionCard({ action, level }: Props) {
  const urgency = URGENCY[level]
  return (
    <div
      className={`rounded-2xl border border-white/5 border-l-4 ${BORDER_COLOR[level]} bg-[#0a160a] p-6`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 text-2xl">💡</div>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Recommended Action
            </h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${urgency.style}`}
            >
              {urgency.label}
            </span>
          </div>
          <p className="text-base font-medium leading-relaxed text-gray-100">{action}</p>
          <p className="mt-4 text-xs text-gray-600">
            For deeper analysis with full soil chemistry and satellite data, use the{' '}
            <a
              href="https://github.com/dhwanilpanchani/FieldPulse"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 underline decoration-green-700 underline-offset-2 hover:text-green-300"
            >
              FieldPulse Claude Code plugin →
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
