'use client'

import { CROP_TYPES, type CropType } from '@/lib/types'

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
    <div className="rounded-2xl bg-[#1a1d27] p-6 shadow-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Field Input
      </h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-400" htmlFor="location-input">
            Farm location
          </label>
          <input
            id="location-input"
            type="text"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            onBlur={onLocationBlur}
            placeholder="e.g. Punjab, India"
            className="w-full rounded-lg bg-[#0f1117] px-4 py-3 text-white placeholder-gray-600 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="sm:w-48">
          <label className="mb-1 block text-xs text-gray-400" htmlFor="crop-select">
            Crop type
          </label>
          <select
            id="crop-select"
            value={cropType}
            onChange={(e) => onCropChange(e.target.value as CropType)}
            className="w-full rounded-lg bg-[#0f1117] px-4 py-3 text-white outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-green-500"
          >
            {CROP_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {resolvedLocation && !geocodeError && (
        <p className="mt-2 text-xs text-green-400">📍 {resolvedLocation}</p>
      )}
      {geocodeError && (
        <p className="mt-2 text-xs text-red-400">{geocodeError}</p>
      )}

      <button
        onClick={onAnalyze}
        disabled={loading || !!geocodeError}
        className="mt-4 w-full rounded-xl bg-green-600 px-6 py-4 text-base font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Analyzing…' : 'Analyze Field'}
      </button>
    </div>
  )
}
