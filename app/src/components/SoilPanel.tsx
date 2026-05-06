'use client'

import type { SoilData } from '@/lib/types'

type Tag = 'optimal' | 'concerning' | 'poor'

function interpret(value: number, low: number, high: number): Tag {
  if (value >= low && value <= high) return 'optimal'
  if (value < low * 0.7 || value > high * 1.3) return 'poor'
  return 'concerning'
}

const TAG_STYLES: Record<Tag, string> = {
  optimal: 'border-green-500/30 bg-green-500/10 text-green-400',
  concerning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  poor: 'border-red-500/30 bg-red-500/10 text-red-400',
}

function Row({ label, value, tag }: { label: string; value: string; tag: Tag }) {
  return (
    <div className="flex items-center justify-between border-t border-white/5 py-2.5">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{value}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TAG_STYLES[tag]}`}>
          {tag}
        </span>
      </div>
    </div>
  )
}

interface Props {
  soil: SoilData
}

export default function SoilPanel({ soil }: Props) {
  const phTag = interpret(soil.ph, 6.0, 7.5)
  const ocTag = interpret(soil.org_carbon_g_per_kg, 10, 30)
  const clayTag = interpret(soil.clay_pct, 15, 40)
  const bdTag: Tag = soil.bulk_density < 1.5 ? 'optimal' : 'concerning'

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a160a] p-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Soil Profile
      </h2>

      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400">
          ⚠ Regional estimates
        </span>
        <span className="text-[10px] text-gray-600">Not field-specific</span>
      </div>

      <div>
        <Row label="pH" value={String(soil.ph)} tag={phTag} />
        <Row label="Organic Carbon" value={`${soil.org_carbon_g_per_kg} g/kg`} tag={ocTag} />
        <Row label="Clay Content" value={`${soil.clay_pct}%`} tag={clayTag} />
        <Row label="Bulk Density" value={`${soil.bulk_density} g/cm³`} tag={bdTag} />
        {soil.root_zone_wetness !== null && (
          <Row
            label="Root Zone Moisture"
            value={soil.root_zone_wetness.toFixed(2)}
            tag={
              soil.root_zone_wetness > 0.4
                ? 'optimal'
                : soil.root_zone_wetness > 0.2
                  ? 'concerning'
                  : 'poor'
            }
          />
        )}
        {soil.topsoil_wetness !== null && (
          <Row
            label="Topsoil Moisture"
            value={soil.topsoil_wetness.toFixed(2)}
            tag={
              soil.topsoil_wetness > 0.4
                ? 'optimal'
                : soil.topsoil_wetness > 0.2
                  ? 'concerning'
                  : 'poor'
            }
          />
        )}
      </div>

      <p className="mt-4 text-[11px] text-gray-600">
        {soil.region} · {soil.source} · Confidence: {soil.confidence}
      </p>
    </div>
  )
}
