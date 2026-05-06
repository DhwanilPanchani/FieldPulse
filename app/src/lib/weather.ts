import type { WeatherData, ForecastData, ForecastDay } from './types'

interface OpenMeteoArchiveResponse {
  daily: {
    time: string[]
    precipitation_sum: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    et0_fao_evapotranspiration: number[]
  }
}

interface OpenMeteoForecastResponse {
  daily: {
    time: string[]
    precipitation_sum: number[]
    temperature_2m_max: number[]
    et0_fao_evapotranspiration: number[]
  }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function fetchWeatherHistory(
  lat: number,
  lon: number,
  heatThreshold: number,
): Promise<WeatherData> {
  const end = new Date()
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 89)

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${formatDate(start)}&end_date=${formatDate(end)}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration` +
    `&timezone=auto`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  const res = await fetch(url, { signal: controller.signal })
  clearTimeout(timer)

  if (!res.ok) throw new Error(`Open-Meteo archive error: ${res.status}`)

  const data = (await res.json()) as OpenMeteoArchiveResponse
  const { time, precipitation_sum, temperature_2m_max, temperature_2m_min, et0_fao_evapotranspiration } =
    data.daily

  let total_precip_mm = 0
  let heat_stress_days = 0
  let water_deficit_mm = 0
  let temp_sum = 0
  let temp_count = 0

  for (let i = 0; i < time.length; i++) {
    const precip = precipitation_sum[i] ?? 0
    const tmax = temperature_2m_max[i] ?? 0
    const tmin = temperature_2m_min[i] ?? 0
    const et0 = et0_fao_evapotranspiration[i] ?? 0

    total_precip_mm += precip
    if (tmax > heatThreshold) heat_stress_days++
    water_deficit_mm += Math.max(0, et0 - precip)
    temp_sum += (tmax + tmin) / 2
    temp_count++
  }

  const avg_temp_c = temp_count > 0 ? temp_sum / temp_count : 0

  let drought_status: string
  if (total_precip_mm < 100) drought_status = 'dry'
  else if (total_precip_mm < 200) drought_status = 'normal'
  else drought_status = 'wet'

  return {
    total_precip_mm: Math.round(total_precip_mm),
    heat_stress_days,
    water_deficit_mm: Math.round(water_deficit_mm),
    avg_temp_c: Math.round(avg_temp_c * 10) / 10,
    drought_status,
  }
}

export async function fetchForecast(
  lat: number,
  lon: number,
  heatThreshold: number,
): Promise<ForecastData> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_sum,temperature_2m_max,et0_fao_evapotranspiration` +
    `&forecast_days=16&timezone=auto`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  const res = await fetch(url, { signal: controller.signal })
  clearTimeout(timer)

  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`)

  const data = (await res.json()) as OpenMeteoForecastResponse
  const { time, precipitation_sum, temperature_2m_max, et0_fao_evapotranspiration } =
    data.daily

  const days: ForecastDay[] = []
  let total_precip_mm = 0
  let heat_stress_days = 0
  let deficit_mm = 0
  let maxDryRun = 0
  let currentDryRun = 0

  for (let i = 0; i < time.length; i++) {
    const precip = precipitation_sum[i] ?? 0
    const tmax = temperature_2m_max[i] ?? 0
    const et0 = et0_fao_evapotranspiration[i] ?? 0

    days.push({ date: time[i], precip, tmax, et0 })
    total_precip_mm += precip
    if (tmax > heatThreshold) heat_stress_days++
    deficit_mm += Math.max(0, et0 - precip)

    if (precip < 2) {
      currentDryRun++
      maxDryRun = Math.max(maxDryRun, currentDryRun)
    } else {
      currentDryRun = 0
    }
  }

  return {
    days,
    total_precip_mm: Math.round(total_precip_mm),
    heat_stress_days,
    deficit_mm: Math.round(deficit_mm),
    consecutive_dry_days: maxDryRun,
  }
}
