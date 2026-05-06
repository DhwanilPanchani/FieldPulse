'use client'

import type { SatelliteData } from '@/lib/types'

interface Props {
  analyzedAt: string
  satellite: SatelliteData
}

function Source({
  status,
  name,
  detail,
}: {
  status: 'ok' | 'warn'
  name: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 text-sm font-bold ${status === 'ok' ? 'text-green-500' : 'text-amber-500'}`}
      >
        {status === 'ok' ? '✓' : '⚠'}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-300">{name}</p>
        <p className="text-xs text-gray-500">{detail}</p>
      </div>
    </div>
  )
}

export default function DataSources({ analyzedAt, satellite }: Props) {
  const date = new Date(analyzedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a160a] p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Data Sources
      </h2>

      <div className="space-y-3">
        <Source
          status="ok"
          name="Weather — Open-Meteo"
          detail="Archive + 16-day forecast · Free, open, real-time"
        />
        <Source
          status="ok"
          name="Soil Moisture — NASA POWER"
          detail="Satellite-derived soil wetness (2022–2024 average)"
        />
        <Source
          status="warn"
          name="Soil Chemistry — Regional Estimates"
          detail="FAO / USDA / ICAR baselines — not field-specific measurements"
        />
        <Source
          status={satellite.available ? 'ok' : 'warn'}
          name="Satellite NDVI — MODIS MOD13Q1"
          detail={
            satellite.available
              ? 'ORNL DAAC · 250 m resolution · 16-day composites'
              : `Unavailable: ${satellite.source}`
          }
        />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-gray-600">
        <span>Analyzed {date}</span>
        <a
          href="https://github.com/dhwanilpanchani/FieldPulse"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-500/70 transition-colors hover:text-green-400"
        >
          FieldPulse on GitHub →
        </a>
      </div>
    </div>
  )
}
