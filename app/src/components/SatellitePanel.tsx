'use client'

import type { SatelliteData } from '@/lib/types'

const TREND_ARROW: Record<string, string> = {
  improving: '↑',
  stable: '→',
  declining: '↓',
  unknown: '?',
}

const TREND_COLOR: Record<string, string> = {
  improving: 'text-green-400',
  stable: 'text-yellow-400',
  declining: 'text-red-400',
  unknown: 'text-gray-400',
}

function ndviColor(ndvi: number): string {
  if (ndvi >= 0.6) return '#52b788'
  if (ndvi >= 0.4) return '#95d5b2'
  if (ndvi >= 0.2) return '#e9c46a'
  return '#e76f51'
}

interface Props {
  satellite: SatelliteData
}

export default function SatellitePanel({ satellite }: Props) {
  return (
    <div className="rounded-2xl bg-[#1a1d27] p-6 shadow-md">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Satellite NDVI
      </h2>

      {satellite.available && satellite.ndvi_mean !== null ? (
        <>
          <div className="mb-4 flex items-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black text-white shadow-lg"
              style={{ backgroundColor: ndviColor(satellite.ndvi_mean) }}
            >
              {satellite.ndvi_mean}
            </div>
            <div>
              <div className="text-xs text-gray-400">NDVI Mean (3 months)</div>
              <div
                className={`mt-1 text-xl font-bold ${TREND_COLOR[satellite.ndvi_trend ?? 'unknown']}`}
              >
                {TREND_ARROW[satellite.ndvi_trend ?? 'unknown']}{' '}
                {satellite.ndvi_trend ?? 'unknown'}
              </div>
              {satellite.anomaly_pct !== null && (
                <div className="mt-1 text-xs text-gray-500">
                  Anomaly: {satellite.anomaly_pct > 0 ? '+' : ''}
                  {satellite.anomaly_pct}% vs baseline
                </div>
              )}
            </div>
          </div>

          {/* NDVI gauge */}
          <div className="relative h-4 overflow-hidden rounded-full bg-gradient-to-r from-[#e76f51] via-[#e9c46a] to-[#52b788]">
            <div
              className="absolute top-0 h-full w-1 -translate-x-1/2 rounded-full bg-white shadow"
              style={{ left: `${satellite.ndvi_mean * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-600">
            <span>0 (bare)</span>
            <span>0.5</span>
            <span>1 (dense)</span>
          </div>

          <p className="mt-3 text-xs text-gray-600">
            {satellite.data_points} data point{satellite.data_points !== 1 ? 's' : ''} &middot;{' '}
            {satellite.source}
          </p>
        </>
      ) : (
        <div className="rounded-lg bg-gray-800/60 px-4 py-6 text-center text-sm text-gray-400">
          <div className="text-3xl">🛰️</div>
          <p className="mt-2">Satellite data unavailable for this location.</p>
          <p className="mt-1 text-xs text-gray-500">
            The Claude Code plugin uses MODIS ORNL directly for full NDVI analysis.
          </p>
          {satellite.source && (
            <p className="mt-2 text-xs text-gray-600 italic">{satellite.source}</p>
          )}
        </div>
      )}
    </div>
  )
}
