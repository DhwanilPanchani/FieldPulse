import type { SatelliteData } from './types'

interface ModisSubsetItem {
  band: string
  data: number[]
  calendar_date: string
}

interface ModisResponse {
  subset: ModisSubsetItem[]
}

function dateToModisDoy(d: Date): string {
  const year = d.getFullYear()
  const start = new Date(year, 0, 0)
  const diff = d.getTime() - start.getTime()
  const doy = Math.floor(diff / 86_400_000)
  return `A${year}${String(doy).padStart(3, '0')}`
}

export async function fetchSatelliteData(lat: number, lon: number): Promise<SatelliteData> {
  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - 3)

  const url =
    `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset` +
    `?latitude=${lat}&longitude=${lon}` +
    `&startDate=${dateToModisDoy(start)}&endDate=${dateToModisDoy(end)}` +
    `&kmAboveBelow=0&kmLeftRight=0`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      return unavailable('MODIS ORNL returned an error')
    }

    const data = (await res.json()) as ModisResponse
    const ndviItems = data.subset?.filter(
      (item) => item.band === '250m_16_days_NDVI',
    ) ?? []

    const validValues: number[] = []
    for (const item of ndviItems) {
      const raw = item.data[0]
      if (raw === undefined || raw === -28672) continue
      validValues.push(raw / 10000.0)
    }

    if (validValues.length === 0) {
      return unavailable('No valid NDVI pixels returned')
    }

    const ndvi_mean = validValues.reduce((a, b) => a + b, 0) / validValues.length
    const current_ndvi = validValues[validValues.length - 1] ?? null
    const first_ndvi = validValues[0] ?? null

    let ndvi_trend: string
    if (first_ndvi === null || current_ndvi === null) {
      ndvi_trend = 'unknown'
    } else {
      const delta = current_ndvi - first_ndvi
      if (delta > 0.05) ndvi_trend = 'improving'
      else if (delta < -0.05) ndvi_trend = 'declining'
      else ndvi_trend = 'stable'
    }

    const anomaly_pct =
      first_ndvi && first_ndvi > 0
        ? Math.round(((ndvi_mean - first_ndvi) / first_ndvi) * 100)
        : null

    return {
      available: true,
      ndvi_mean: Math.round(ndvi_mean * 1000) / 1000,
      ndvi_trend,
      current_ndvi: current_ndvi !== null ? Math.round(current_ndvi * 1000) / 1000 : null,
      anomaly_pct,
      data_points: validValues.length,
      source: 'MODIS MOD13Q1 via ORNL DAAC',
    }
  } catch {
    clearTimeout(timer)
    return unavailable('MODIS ORNL unreachable or timed out')
  }
}

function unavailable(reason: string): SatelliteData {
  return {
    available: false,
    ndvi_mean: null,
    ndvi_trend: null,
    current_ndvi: null,
    anomaly_pct: null,
    data_points: 0,
    source: reason,
  }
}
