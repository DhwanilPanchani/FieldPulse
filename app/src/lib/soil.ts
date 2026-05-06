import type { SoilData } from './types'

interface NasaPowerResponse {
  properties: {
    parameter: {
      GWETROOT: Record<string, number>
      GWETPROF: Record<string, number>
    }
  }
}

interface RegionalBaseline {
  region: string
  org_carbon_g_per_kg: number
  ph: number
  clay_pct: number
  bulk_density: number
}

function getRegionalBaseline(lat: number, lon: number): RegionalBaseline {
  // South Asia
  if (lat >= 8 && lat <= 37 && lon >= 60 && lon <= 97) {
    return { region: 'South Asia', org_carbon_g_per_kg: 6.2, ph: 7.8, clay_pct: 28, bulk_density: 1.42 }
  }
  // Sub-Saharan Africa
  if (lat >= -35 && lat <= 15 && lon >= -20 && lon <= 55) {
    return { region: 'Sub-Saharan Africa', org_carbon_g_per_kg: 9.1, ph: 6.2, clay_pct: 22, bulk_density: 1.38 }
  }
  // Southeast Asia
  if (lat >= -10 && lat <= 25 && lon >= 97 && lon <= 145) {
    return { region: 'Southeast Asia', org_carbon_g_per_kg: 18.4, ph: 5.8, clay_pct: 35, bulk_density: 1.25 }
  }
  // North America (Great Plains / Midwest)
  if (lat >= 25 && lat <= 55 && lon >= -110 && lon <= -60) {
    return { region: 'North America', org_carbon_g_per_kg: 22.3, ph: 6.5, clay_pct: 25, bulk_density: 1.35 }
  }
  // Europe
  if (lat >= 35 && lat <= 72 && lon >= -10 && lon <= 40) {
    return { region: 'Europe', org_carbon_g_per_kg: 19.7, ph: 6.8, clay_pct: 24, bulk_density: 1.30 }
  }
  // South America
  if (lat >= -55 && lat <= 10 && lon >= -80 && lon <= -35) {
    return { region: 'South America', org_carbon_g_per_kg: 14.6, ph: 5.9, clay_pct: 30, bulk_density: 1.32 }
  }
  // East Asia
  if (lat >= 20 && lat <= 55 && lon >= 100 && lon <= 145) {
    return { region: 'East Asia', org_carbon_g_per_kg: 11.8, ph: 6.4, clay_pct: 26, bulk_density: 1.38 }
  }
  // Default global average
  return { region: 'Global Average', org_carbon_g_per_kg: 13.0, ph: 6.5, clay_pct: 26, bulk_density: 1.35 }
}

export async function fetchSoilData(lat: number, lon: number): Promise<SoilData> {
  const baseline = getRegionalBaseline(lat, lon)

  const url =
    `https://power.larc.nasa.gov/api/temporal/monthly/point` +
    `?parameters=GWETROOT,GWETPROF&community=AG` +
    `&longitude=${lon}&latitude=${lat}` +
    `&start=2022&end=2024&format=JSON`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      return {
        ...baseline,
        root_zone_wetness: null,
        topsoil_wetness: null,
        source: 'FAO/USDA/ICAR regional estimates (NASA POWER unavailable)',
        confidence: 'low',
      }
    }

    const data = (await res.json()) as NasaPowerResponse
    const gwetRoot = data.properties?.parameter?.GWETROOT ?? {}
    const gwetProf = data.properties?.parameter?.GWETPROF ?? {}

    const rootValues = Object.values(gwetRoot).filter(
      (v) => typeof v === 'number' && v >= 0 && v <= 1,
    )
    const profValues = Object.values(gwetProf).filter(
      (v) => typeof v === 'number' && v >= 0 && v <= 1,
    )

    const root_zone_wetness =
      rootValues.length > 0
        ? Math.round((rootValues.reduce((a, b) => a + b, 0) / rootValues.length) * 100) / 100
        : null

    const topsoil_wetness =
      profValues.length > 0
        ? Math.round((profValues.reduce((a, b) => a + b, 0) / profValues.length) * 100) / 100
        : null

    return {
      ...baseline,
      root_zone_wetness,
      topsoil_wetness,
      source: 'Regional estimates (FAO/USDA/ICAR) + NASA POWER soil moisture',
      confidence: 'medium',
    }
  } catch {
    clearTimeout(timer)
    return {
      ...baseline,
      root_zone_wetness: null,
      topsoil_wetness: null,
      source: 'FAO/USDA/ICAR regional estimates only',
      confidence: 'low',
    }
  }
}
