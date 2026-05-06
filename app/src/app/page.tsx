'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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
  { icon: '🌡️', text: 'Fetching weather & climate data…' },
  { icon: '🛰️', text: 'Querying satellite NDVI imagery…' },
  { icon: '🌱', text: 'Analyzing soil chemistry signals…' },
  { icon: '⚡', text: 'Computing composite risk score…' },
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
  const resultsRef = useRef<HTMLDivElement>(null)

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
    }, 900)

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

  useEffect(() => {
    if (analysis && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [analysis])

  const heatThreshold = HEAT_THRESHOLDS[cropType] ?? 33

  return (
    <div className="min-h-screen bg-[#050b05]">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 z-50 w-full border-b border-green-900/20 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🌱</span>
            <span className="text-lg font-bold tracking-tight text-white">FieldPulse</span>
            <span className="hidden rounded-full border border-green-800/50 bg-green-900/30 px-2.5 py-0.5 text-[10px] font-medium text-green-400 sm:block">
              FREE
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/dhwanilpanchani/FieldPulse"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 transition-colors hover:text-green-400"
            >
              GitHub
            </a>
            {analysis && (
              <a
                href="#results"
                className="rounded-lg border border-green-700/40 bg-green-700/20 px-4 py-1.5 text-sm font-medium text-green-400 transition-all hover:bg-green-700/30"
              >
                View Results ↓
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative flex min-h-screen items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1920&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/10" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-32 lg:grid-cols-2">
          {/* Left: Brand copy */}
          <div>
            <div className="animate-fade-in-up mb-5 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Free · No account required · Real satellite data
            </div>

            <h1 className="animate-fade-in-up delay-100 mb-4 text-5xl font-black leading-[1.1] tracking-tight text-white lg:text-6xl">
              Agricultural
              <br />
              <span className="text-green-400">Risk Intelligence</span>
            </h1>

            <p className="animate-fade-in-up delay-200 mb-8 max-w-md text-lg leading-relaxed text-gray-300">
              Detect crop failure risk before it happens. Satellite imagery, soil chemistry, and
              weather data fused into a single early-warning score.
            </p>

            <div className="animate-fade-in-up delay-300 flex flex-wrap gap-3">
              {[
                { icon: '🛰️', label: 'MODIS + Sentinel-2 NDVI' },
                { icon: '🌡️', label: 'Open-Meteo 16-day forecast' },
                { icon: '🌱', label: 'ISRIC SoilGrids chemistry' },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 backdrop-blur-sm"
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form card */}
          <div className="animate-fade-in-up delay-200">
            <div className="glass rounded-2xl p-8 shadow-2xl">
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

              {error && !loading && (
                <div className="mt-4 rounded-xl border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {loading && (
                <div className="mt-6 space-y-2">
                  {LOADING_STEPS.map((step, i) => (
                    <div
                      key={step.text}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-500 ${
                        i === loadingStep
                          ? 'bg-green-900/30 text-green-300'
                          : i < loadingStep
                            ? 'text-gray-600'
                            : 'text-gray-700'
                      }`}
                    >
                      <span className={i === loadingStep ? 'animate-bounce' : ''}>
                        {step.icon}
                      </span>
                      <span>
                        {i < loadingStep && '✓ '}
                        {step.text}
                      </span>
                      {i === loadingStep && (
                        <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        {!analysis && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-gray-500">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </section>

      {/* ── Results ── */}
      {analysis && !loading && (
        <section id="results" ref={resultsRef} className="bg-[#050b05] px-4 pb-24 pt-16">
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="mb-8 text-center">
              <div className="text-sm font-medium text-green-500">Analysis Complete</div>
              <h2 className="mt-1 text-2xl font-bold text-white">{analysis.location_name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {analysis.crop_type.charAt(0).toUpperCase() + analysis.crop_type.slice(1)} ·
                Confidence {analysis.confidence_pct}% · {analysis.forecast.days.length}-day forecast
              </p>
            </div>

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

            <ForecastChart days={analysis.forecast.days} heatThreshold={heatThreshold} />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SatellitePanel satellite={analysis.satellite} />
              <SoilPanel soil={analysis.soil} />
            </div>

            <DataSources analyzedAt={analysis.analyzed_at} satellite={analysis.satellite} />

            <p className="text-center text-xs text-gray-600">
              Analysis confidence: {analysis.confidence_pct}% &middot; Based on{' '}
              {analysis.forecast.days.length} days of forecast data
            </p>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-green-900/20 bg-black/30 py-8">
        <div className="mx-auto max-w-4xl px-6 text-center text-xs text-gray-600">
          <p>FieldPulse — Open-source agricultural risk intelligence. Free for everyone.</p>
          <p className="mt-1">
            Built with Open-Meteo · NASA POWER · MODIS ORNL DAAC · ISRIC SoilGrids
          </p>
        </div>
      </footer>
    </div>
  )
}
