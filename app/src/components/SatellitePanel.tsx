'use client'

import type { SatelliteData } from '@/lib/types'

const TREND_CONFIG: Record<string, { arrow: string; label: string; color: string }> = {
  improving: { arrow: '↑', label: 'Improving', color: 'text-green-400' },
  stable: { arrow: '→', label: 'Stable', color: 'text-amber-400' },
  declining: { arrow: '↓', label: 'Declining', color: 'text-red-400' },
  unknown: { arrow: '?', label: 'Unknown', color: 'text-gray-400' },
}

function ndviStroke(ndvi: number): string {
  if (ndvi >= 0.6) return '#22c55e'
  if (ndvi >= 0.4) return '#86efac'
  if (ndvi >= 0.2) return '#fbbf24'
  return '#f87171'
}

function ndviLabel(ndvi: number): string {
  if (ndvi >= 0.6) return 'Dense vegetation'
  if (ndvi >= 0.4) return 'Moderate vegetation'
  if (ndvi >= 0.2) return 'Sparse vegetation'
  return 'Very low / stressed'
}

interface Props {
  satellite: SatelliteData
}

export default function SatellitePanel({ satellite }: Props) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a160a] p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Satellite NDVI
      </h2>

      {satellite.available && satellite.ndvi_mean !== null ? (
        <>
          <div className="mb-5 flex items-center gap-5">
            {/* Ring gauge */}
            <div className="relative flex-shrink-0">
              <svg width="80" height="80" className="-rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="6"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke={ndviStroke(satellite.ndvi_mean)}
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 * (1 - satellite.ndvi_mean)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-black text-white">
                  {satellite.ndvi_mean.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500">NDVI Mean (3 months)</p>
              <p className="text-sm font-medium text-gray-300">{ndviLabel(satellite.ndvi_mean)}</p>
              {satellite.ndvi_trend && (
                <div
                  className={`mt-1 flex items-center gap-1 text-sm font-bold ${
                    TREND_CONFIG[satellite.ndvi_trend]?.color ?? 'text-gray-400'
                  }`}
                >
                  <span>{TREND_CONFIG[satellite.ndvi_trend]?.arrow}</span>
                  <span>{TREND_CONFIG[satellite.ndvi_trend]?.label}</span>
                </div>
              )}
              {satellite.anomaly_pct !== null && (
                <p className="mt-0.5 text-xs text-gray-600">
                  {satellite.anomaly_pct > 0 ? '+' : ''}
                  {satellite.anomaly_pct}% vs baseline
                </p>
              )}
            </div>
          </div>

          {/* NDVI gradient gauge */}
          <div>
            <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-amber-400 via-lime-400 to-green-500">
              <div
                className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-1 ring-black/20"
                style={{ left: `${(satellite.ndvi_mean ?? 0) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-600">
              <span>0 — bare soil</span>
              <span>0.5</span>
              <span>1 — dense crops</span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-gray-600">
            {satellite.data_points} observation{satellite.data_points !== 1 ? 's' : ''} ·{' '}
            {satellite.source}
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-8 text-center">
          <div className="mb-2 text-3xl">🛰️</div>
          <p className="text-sm text-gray-400">Satellite data unavailable</p>
          <p className="mt-1 text-xs text-gray-600">
            {satellite.source || 'No data for this location and time period.'}
          </p>
        </div>
      )}
    </div>
  )
}
