export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#52b788',
  MEDIUM: '#e9c46a',
  HIGH: '#f4a261',
  CRITICAL: '#e76f51',
}

export interface WeatherData {
  total_precip_mm: number
  heat_stress_days: number
  water_deficit_mm: number
  avg_temp_c: number
  drought_status: string
}

export interface ForecastDay {
  date: string
  precip: number
  tmax: number
  et0: number
}

export interface ForecastData {
  days: ForecastDay[]
  total_precip_mm: number
  heat_stress_days: number
  deficit_mm: number
  consecutive_dry_days: number
}

export interface SoilData {
  region: string
  org_carbon_g_per_kg: number
  ph: number
  clay_pct: number
  bulk_density: number
  root_zone_wetness: number | null
  topsoil_wetness: number | null
  source: string
  confidence: 'low' | 'medium' | 'high'
}

export interface SatelliteData {
  available: boolean
  ndvi_mean: number | null
  ndvi_trend: string | null
  current_ndvi: number | null
  anomaly_pct: number | null
  data_points: number
  source: string
}

export interface FieldAnalysis {
  location_name: string
  lat: number
  lon: number
  crop_type: string
  analyzed_at: string
  risk_score: number
  risk_level: RiskLevel
  trajectory: { day30: RiskLevel; day60: RiskLevel; day90: RiskLevel }
  top_action: string
  weather: WeatherData
  forecast: ForecastData
  soil: SoilData
  satellite: SatelliteData
  confidence_pct: number
}

export interface GeocodeResult {
  lat: number
  lon: number
  display_name: string
  country: string
}

export const CROP_TYPES = [
  { value: 'wheat', label: 'Wheat' },
  { value: 'rice', label: 'Rice' },
  { value: 'maize', label: 'Maize / Corn' },
  { value: 'soybean', label: 'Soybean' },
  { value: 'cotton', label: 'Cotton' },
  { value: 'generic', label: 'Generic / Other' },
] as const

export type CropType = (typeof CROP_TYPES)[number]['value']
