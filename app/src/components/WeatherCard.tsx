'use client'

import type { WeatherData, ForecastData } from '@/lib/types'

interface MetricProps {
  icon: string
  label: string
  value: string
  context: string
}

function Metric({ icon, label, value, context }: MetricProps) {
  return (
    <div className="rounded-xl bg-[#0f1117] p-4">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{context}</div>
    </div>
  )
}

interface Props {
  weather: WeatherData
  forecast: ForecastData
  cropType: string
}

export default function WeatherCard({ weather, forecast, cropType }: Props) {
  return (
    <div className="rounded-2xl bg-[#1a1d27] p-6 shadow-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
        Weather Signals
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon="🌧️"
          label="Rainfall (90 days)"
          value={`${weather.total_precip_mm} mm`}
          context={`Status: ${weather.drought_status}`}
        />
        <Metric
          icon="🌡️"
          label="Heat stress days"
          value={`${weather.heat_stress_days} days`}
          context={`Above heat threshold for ${cropType}`}
        />
        <Metric
          icon="💧"
          label="Water deficit"
          value={`${weather.water_deficit_mm} mm`}
          context="ET₀ minus rainfall"
        />
        <Metric
          icon="⛅"
          label="Forecast rain"
          value={`${forecast.total_precip_mm} mm`}
          context={`${forecast.days.length}-day outlook`}
        />
      </div>
    </div>
  )
}
