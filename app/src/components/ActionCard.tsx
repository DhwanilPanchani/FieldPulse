'use client'

import { RISK_COLORS, type RiskLevel } from '@/lib/types'

interface Props {
  action: string
  level: RiskLevel
}

export default function ActionCard({ action, level }: Props) {
  return (
    <div
      className="rounded-2xl bg-[#1a1d27] p-6 shadow-md"
      style={{ borderLeft: `4px solid ${RISK_COLORS[level]}` }}
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Recommended Action
      </h2>
      <p className="text-base font-semibold leading-relaxed text-white">{action}</p>
      <p className="mt-4 text-xs text-gray-500">
        For full analysis including soil chemistry and satellite vegetation data, use the{' '}
        <a
          href="https://github.com/dhwanilpanchani/agrosentinel"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 underline hover:text-green-300"
        >
          FieldPulse Claude Code plugin →
        </a>
      </p>
    </div>
  )
}
