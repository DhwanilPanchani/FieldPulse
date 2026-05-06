'use client'

import type { SatelliteData } from '@/lib/types'

interface Props {
  analyzedAt: string
  satellite: SatelliteData
}

export default function DataSources({ analyzedAt, satellite }: Props) {
  const date = new Date(analyzedAt).toLocaleString()

  return (
    <div className="rounded-2xl bg-[#1a1d27] p-6 shadow-md">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Data Sources
      </h2>

      <ul className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span>✅</span>
          <span>
            <strong className="text-white">Weather:</strong>{' '}
            <span className="text-gray-400">
              Open-Meteo archive + forecast (real-time, free, open)
            </span>
          </span>
        </li>
        <li className="flex gap-2">
          <span>✅</span>
          <span>
            <strong className="text-white">Soil moisture:</strong>{' '}
            <span className="text-gray-400">NASA POWER satellite (2022–2024 average)</span>
          </span>
        </li>
        <li className="flex gap-2">
          <span>⚠️</span>
          <span>
            <strong className="text-white">Soil chemistry:</strong>{' '}
            <span className="text-gray-400">
              Regional scientific estimates (FAO / USDA / ICAR) — not field-specific
            </span>
          </span>
        </li>
        <li className="flex gap-2">
          <span>{satellite.available ? '✅' : '⚠️'}</span>
          <span>
            <strong className="text-white">Satellite NDVI:</strong>{' '}
            <span className="text-gray-400">
              {satellite.available
                ? 'MODIS MOD13Q1 via ORNL DAAC'
                : 'MODIS ORNL (unavailable for this location)'}
            </span>
          </span>
        </li>
      </ul>

      <p className="mt-4 border-t border-gray-800 pt-3 text-xs text-gray-600">
        Analyzed {date} &middot; FieldPulse is open source &middot;{' '}
        <a
          href="https://github.com/dhwanilpanchani/agrosentinel"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 underline hover:text-green-300"
        >
          GitHub
        </a>{' '}
        &middot; Built with Open-Meteo, NASA POWER, MODIS ORNL
      </p>
    </div>
  )
}
