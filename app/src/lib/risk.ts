import type { WeatherData, ForecastData, SatelliteData, RiskLevel } from './types'

export const HEAT_THRESHOLDS: Record<string, number> = {
  wheat: 32,
  rice: 35,
  maize: 34,
  soybean: 34,
  cotton: 38,
  generic: 33,
}

export function getHeatThreshold(cropType: string): number {
  return HEAT_THRESHOLDS[cropType] ?? HEAT_THRESHOLDS.generic
}

export function scoreToLevel(score: number): RiskLevel {
  if (score <= 25) return 'LOW'
  if (score <= 50) return 'MEDIUM'
  if (score <= 75) return 'HIGH'
  return 'CRITICAL'
}

export function computeRiskScore(
  weather: WeatherData,
  forecast: ForecastData,
  satellite: SatelliteData,
): number {
  const heat_score = Math.min(
    100,
    weather.heat_stress_days * 8 + forecast.heat_stress_days * 12,
  )
  const drought_score = Math.min(
    100,
    weather.water_deficit_mm / 3 + forecast.deficit_mm / 2,
  )

  const vegetation_penalty =
    satellite.available && satellite.ndvi_mean !== null && satellite.ndvi_mean < 0.2
      ? 15
      : 0

  return Math.min(
    100,
    heat_score * 0.4 + drought_score * 0.5 + vegetation_penalty,
  )
}

export function computeTrajectory(
  currentLevel: RiskLevel,
  forecast: ForecastData,
): { day30: RiskLevel; day60: RiskLevel; day90: RiskLevel } {
  const ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

  function stepDown(level: RiskLevel): RiskLevel {
    const idx = ORDER.indexOf(level)
    return idx > 0 ? ORDER[idx - 1] : level
  }

  const day30 = currentLevel
  const day60 = forecast.total_precip_mm > 60 ? stepDown(currentLevel) : currentLevel
  const day90 = stepDown(day60)

  return { day30, day60, day90 }
}

export function buildTopAction(
  risk_level: RiskLevel,
  weather: WeatherData,
  forecast: ForecastData,
  cropType: string,
): string {
  const threshold = getHeatThreshold(cropType)
  const deficit = weather.water_deficit_mm + forecast.deficit_mm

  if (risk_level === 'CRITICAL') {
    if (weather.water_deficit_mm > weather.heat_stress_days * 5) {
      return `Severe water deficit (${deficit}mm). Irrigate immediately — apply water in early morning to minimize evaporation. Check soil moisture at 30cm depth daily.`
    }
    return `Extreme heat stress (${forecast.heat_stress_days} days above ${threshold}°C forecast). Apply irrigation now to cool crop canopy. Consider shade netting for vulnerable growth stages.`
  }
  if (risk_level === 'HIGH') {
    return `Elevated stress building. Monitor soil moisture daily and activate irrigation if no rain within 4 days. Scout fields for early stress symptoms.`
  }
  if (risk_level === 'MEDIUM') {
    return `Moderate stress signals. Increase field checks to every 2–3 days. Prepare irrigation system as a precaution.`
  }
  return `Conditions favorable. Maintain current management and monitor the 16-day forecast for any changes.`
}

export function computeConfidence(
  satellite: SatelliteData,
  weatherDays: number,
): number {
  let score = 60
  if (satellite.available) score += 20
  if (weatherDays >= 80) score += 20
  else if (weatherDays >= 50) score += 10
  return Math.min(100, score)
}
