'use client'

import type { SoilData } from '@/lib/types'

function interpret(value: number, low: number, high: number): string {
  if (value >= low && value <= high) return 'optimal'
  if (value < low * 0.7 || value > high * 1.3) return 'poor'
  return 'concerning'
}

const TAG_COLORS: Record<string, string> = {
  optimal: 'bg-green-900 text-green-300',
  concerning: 'bg-yellow-900 text-yellow-300',
  poor: 'bg-red-900 text-red-300',
}

function Row({ label, value, tag }: { label: string; value: string; tag: string }) {
  return (
    <tr className="border-t border-gray-800">
      <td className="py-2 pr-4 text-sm text-gray-400">{label}</td>
      <td className="py-2 pr-4 text-sm text-white">{value}</td>
      <td className="py-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${TAG_COLORS[tag]}`}>{tag}</span>
      </td>
    </tr>
  )
}

interface Props {
  soil: SoilData
}

export default function SoilPanel({ soil }: Props) {
  const phTag = interpret(soil.ph, 6.0, 7.5)
  const ocTag = interpret(soil.org_carbon_g_per_kg, 10, 30)
  const clayTag = interpret(soil.clay_pct, 15, 40)

  return (
    <div className="rounded-2xl bg-[#1a1d27] p-6 shadow-md">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Soil Profile
      </h2>

      <div className="mb-4 rounded-lg bg-yellow-900/30 px-4 py-2 text-xs text-yellow-300">
        ⚠️ Regional estimates — not field-specific measurements
      </div>

      <table className="w-full">
        <tbody>
          <Row label="pH" value={String(soil.ph)} tag={phTag} />
          <Row
            label="Organic Carbon"
            value={`${soil.org_carbon_g_per_kg} g/kg`}
            tag={ocTag}
          />
          <Row label="Clay content" value={`${soil.clay_pct}%`} tag={clayTag} />
          <Row
            label="Bulk density"
            value={`${soil.bulk_density} g/cm³`}
            tag={soil.bulk_density < 1.5 ? 'optimal' : 'concerning'}
          />
          {soil.root_zone_wetness !== null && (
            <Row
              label="Root zone moisture"
              value={`${soil.root_zone_wetness} (0–1)`}
              tag={soil.root_zone_wetness > 0.4 ? 'optimal' : soil.root_zone_wetness > 0.2 ? 'concerning' : 'poor'}
            />
          )}
          {soil.topsoil_wetness !== null && (
            <Row
              label="Topsoil moisture"
              value={`${soil.topsoil_wetness} (0–1)`}
              tag={soil.topsoil_wetness > 0.4 ? 'optimal' : soil.topsoil_wetness > 0.2 ? 'concerning' : 'poor'}
            />
          )}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-gray-600">
        Region: {soil.region} &middot; Source: {soil.source} &middot; Confidence:{' '}
        {soil.confidence}
      </p>
    </div>
  )
}
