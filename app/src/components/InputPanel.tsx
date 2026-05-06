'use client'

import { CROP_TYPES, type CropType } from '@/lib/types'

const CROP_ICONS: Record<string, string> = {
  wheat: '🌾',
  rice: '🍚',
  maize: '🌽',
  soybean: '🫘',
  cotton: '🤍',
  generic: '🌿',
}

interface Props {
  location: string
  cropType: CropType
  resolvedLocation: string | null
  geocodeError: string | null
  loading: boolean
  onLocationChange: (v: string) => void
  onLocationBlur: () => void
  onCropChange: (v: CropType) => void
  onAnalyze: () => void
}

export default function InputPanel({
  location,
  cropType,
  resolvedLocation,
  geocodeError,
  loading,
  onLocationChange,
  onLocationBlur,
  onCropChange,
  onAnalyze,
}: Props) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-white">Analyze Your Field</h2>
      <p className="mb-6 text-sm text-gray-400">Enter a location and crop type to get started.</p>

      {/* Location */}
      <div className="mb-5">
        <label
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-green-400"
          htmlFor="location-input"
        >
          Location
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            📍
          </span>
          <input
            id="location-input"
            type="text"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            onBlur={onLocationBlur}
            placeholder="e.g. Punjab, India or Iowa, USA"
            className="w-full rounded-xl border border-green-900/50 bg-black/40 py-3 pl-10 pr-4 text-white placeholder-gray-600 transition-all focus:border-green-500/60 focus:outline-none focus:ring-1 focus:ring-green-500/30"
          />
        </div>
        {resolvedLocation && !geocodeError && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-green-400">
            <span>✓</span> {resolvedLocation}
          </p>
        )}
        {geocodeError && (
          <p className="mt-1.5 text-xs text-red-400">⚠ {geocodeError}</p>
        )}
      </div>

      {/* Crop type */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-green-400">
          Crop Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CROP_TYPES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onCropChange(c.value as CropType)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition-all ${
                cropType === c.value
                  ? 'border-green-500/60 bg-green-500/20 text-green-300 shadow-[0_0_12px_rgba(74,222,128,0.15)]'
                  : 'border-green-900/30 bg-black/20 text-gray-400 hover:border-green-800/50 hover:text-gray-300'
              }`}
            >
              <span>{CROP_ICONS[c.value]}</span>
              <span>{c.label.split(' /')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={onAnalyze}
        disabled={loading || !!geocodeError}
        className="group relative w-full overflow-hidden rounded-xl bg-green-600 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Analyzing…
            </>
          ) : (
            <>
              <span>🔍</span>
              Analyze Field
            </>
          )}
        </span>
        {!loading && (
          <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-green-500/0 via-white/10 to-green-500/0 transition-transform duration-700 group-hover:translate-x-[100%]" />
        )}
      </button>
    </div>
  )
}
