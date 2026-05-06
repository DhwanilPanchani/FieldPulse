'use client'

import { useState, useCallback } from 'react'
import InputPanel from '@/components/InputPanel'
import RiskBadge from '@/components/RiskBadge'
import WeatherCard from '@/components/WeatherCard'
import ForecastChart from '@/components/ForecastChart'
import TrajectoryTimeline from '@/components/TrajectoryTimeline'
import ActionCard from '@/components/ActionCard'
import SoilPanel from '@/components/SoilPanel'
import SatellitePanel from '@/components/SatellitePanel'
import DataSources from '@/components/DataSources'
import type { FieldAnalysis, GeocodeResult, CropType } from '@/lib/types'
import { HEAT_THRESHOLDS } from '@/lib/risk'

const LOADING_STEPS = [
  'Fetching weather data…',
  'Querying satellite imagery…',
  'Analyzing stress signals…',
  'Computing risk score…',
]

export default function Home() {
  const [location, setLocation] = useState('Punjab, India')
  const [cropType, setCropType] = useState<CropType>('wheat')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<FieldAnalysis | null>(null)
  const [locationData, setLocationData] = useState<GeocodeResult | null>(null)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)

  const geocode = useCallback(async (loc: string) => {
    if (!loc.trim()) return
    try {
      const res = await fetch(`/api/geocode?location=${encodeURIComponent(loc)}`)
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        setGeocodeError(body.error ?? 'Location not found')
        setLocationData(null)
        return
      }
      const data = (await res.json()) as GeocodeResult
      setLocationData(data)
      setGeocodeError(null)
    } catch {
      setGeocodeError('Could not reach geocoding service')
      setLocationData(null)
    }
  }, [])

  const handleLocationBlur = useCallback(() => {
    geocode(location)
  }, [location, geocode])

  const handleAnalyze = useCallback(async () => {
    let coords = locationData

    if (!coords) {
      setError(null)
      try {
        const res = await fetch(`/api/geocode?location=${encodeURIComponent(location)}`)
        if (!res.ok) {
          setError('Could not find that location. Please check the name and try again.')
          return
        }
        coords = (await res.json()) as GeocodeResult
        setLocationData(coords)
        setGeocodeError(null)
      } catch {
        setError('Geocoding failed. Please try again.')
        return
      }
    }

    setLoading(true)
    setError(null)
    setLoadingStep(0)

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1))
    }, 800)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: coords.lat,
          lon: coords.lon,
          crop_type: cropType,
          location_name: coords.display_name,
        }),
      })

      clearInterval(stepInterval)

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        setError(body.error ?? 'Analysis failed. Please try again.')
        return
      }

      const data = (await res.json()) as FieldAnalysis
      setAnalysis(data)
    } catch {
      clearInterval(stepInterval)
      setError('Network error. Please check your connection and try again.')
    } finally {
      clearInterval(stepInterval)
      setLoading(false)
    }
  }, [location, locationData, cropType])

  const heatThreshold = HEAT_THRESHOLDS[cropType] ?? 33

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-white">
            🌾 FieldPulse
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Agricultural risk intelligence — free, open, no account required
          </p>
        </div>

        {/* Input */}
        <InputPanel
          location={location}
          cropType={cropType}
          resolvedLocation={locationData?.display_name ?? null}
          geocodeError={geocodeError}
          loading={loading}
          onLocationChange={(v) => {
            setLocation(v)
            setLocationData(null)
            setGeocodeError(null)
          }}
          onLocationBlur={handleLocationBlur}
          onCropChange={setCropType}
          onAnalyze={handleAnalyze}
        />

        {/* Loading */}
        {loading && (
          <div className="mt-6 rounded-2xl bg-[#1a1d27] p-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
            <p className="text-sm text-gray-300">{LOADING_STEPS[loadingStep]}</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mt-6 rounded-2xl bg-red-900/30 p-5 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Results */}
        {analysis && !loading && (
          <div className="mt-6 flex flex-col gap-4">
            <RiskBadge
              level={analysis.risk_level}
              score={analysis.risk_score}
              locationName={analysis.location_name}
              analyzedAt={analysis.analyzed_at}
            />

            <ActionCard action={analysis.top_action} level={analysis.risk_level} />

            <TrajectoryTimeline
              current={analysis.risk_level}
              day30={analysis.trajectory.day30}
              day60={analysis.trajectory.day60}
              day90={analysis.trajectory.day90}
            />

            <WeatherCard
              weather={analysis.weather}
              forecast={analysis.forecast}
              cropType={analysis.crop_type}
            />

            <ForecastChart
              days={analysis.forecast.days}
              heatThreshold={heatThreshold}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SatellitePanel satellite={analysis.satellite} />
              <SoilPanel soil={analysis.soil} />
            </div>

            <DataSources
              analyzedAt={analysis.analyzed_at}
              satellite={analysis.satellite}
            />

            <p className="text-center text-xs text-gray-600">
              Analysis confidence: {analysis.confidence_pct}% &middot; Based on{' '}
              {analysis.forecast.days.length} days of forecast data
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
