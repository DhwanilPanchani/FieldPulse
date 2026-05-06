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

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: AnalyzeBody

  try {
    body = (await request.json()) as AnalyzeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { lat, lon, crop_type, location_name } = body

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return NextResponse.json({ error: 'lat and lon must be numbers' }, { status: 400 })
  }

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
