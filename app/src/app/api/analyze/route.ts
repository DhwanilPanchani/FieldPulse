import { NextRequest, NextResponse } from 'next/server'
import { fetchWeatherHistory, fetchForecast } from '@/lib/weather'
import { fetchSatelliteData } from '@/lib/satellite'
import { fetchSoilData } from '@/lib/soil'
import {
  computeRiskScore,
  computeTrajectory,
  buildTopAction,
  computeConfidence,
  scoreToLevel,
  getHeatThreshold,
} from '@/lib/risk'
import type { FieldAnalysis } from '@/lib/types'

interface AnalyzeBody {
  lat: number
  lon: number
  crop_type: string
  location_name: string
}

const VALID_CROPS = new Set(['wheat', 'rice', 'maize', 'soybean', 'cotton', 'generic'])

function validateBody(raw: unknown): AnalyzeBody | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const lat = Number(b.lat)
  const lon = Number(b.lon)
  if (!isFinite(lat) || lat < -90 || lat > 90) return null
  if (!isFinite(lon) || lon < -180 || lon > 180) return null
  const crop_type = String(b.crop_type ?? '')
  if (!VALID_CROPS.has(crop_type)) return null
  const location_name = String(b.location_name ?? '')
    .replace(/[<>"'`]/g, '')
    .trim()
    .slice(0, 200)
  if (location_name.length < 2) return null
  return { lat, lon, crop_type, location_name }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = validateBody(raw)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 })
  }

  const { lat, lon, crop_type, location_name } = body

  const heatThreshold = getHeatThreshold(crop_type)

  const [weatherResult, forecastResult, satelliteResult, soilResult] =
    await Promise.allSettled([
      fetchWeatherHistory(lat, lon, heatThreshold),
      fetchForecast(lat, lon, heatThreshold),
      fetchSatelliteData(lat, lon),
      fetchSoilData(lat, lon),
    ])

  if (weatherResult.status === 'rejected') {
    return NextResponse.json(
      { error: `Weather data unavailable: ${String(weatherResult.reason)}` },
      { status: 502 },
    )
  }
  if (forecastResult.status === 'rejected') {
    return NextResponse.json(
      { error: `Forecast data unavailable: ${String(forecastResult.reason)}` },
      { status: 502 },
    )
  }

  const weather = weatherResult.value
  const forecast = forecastResult.value
  const satellite = satelliteResult.status === 'fulfilled'
    ? satelliteResult.value
    : {
        available: false as const,
        ndvi_mean: null,
        ndvi_trend: null,
        current_ndvi: null,
        anomaly_pct: null,
        data_points: 0,
        source: 'Satellite fetch failed',
      }
  const soil = soilResult.status === 'fulfilled'
    ? soilResult.value
    : {
        region: 'Unknown',
        org_carbon_g_per_kg: 13.0,
        ph: 6.5,
        clay_pct: 26,
        bulk_density: 1.35,
        root_zone_wetness: null,
        topsoil_wetness: null,
        source: 'Soil data unavailable',
        confidence: 'low' as const,
      }

  const risk_score = Math.round(computeRiskScore(weather, forecast, satellite))
  const risk_level = scoreToLevel(risk_score)
  const trajectory = computeTrajectory(risk_level, forecast)
  const top_action = buildTopAction(risk_level, weather, forecast, crop_type)
  const confidence_pct = computeConfidence(satellite, forecast.days.length)

  const analysis: FieldAnalysis = {
    location_name,
    lat,
    lon,
    crop_type,
    analyzed_at: new Date().toISOString(),
    risk_score,
    risk_level,
    trajectory,
    top_action,
    weather,
    forecast,
    soil,
    satellite,
    confidence_pct,
  }

  return NextResponse.json(analysis)
}
