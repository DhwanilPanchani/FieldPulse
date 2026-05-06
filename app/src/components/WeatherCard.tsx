'use client'

import type { WeatherData, ForecastData } from '@/lib/types'

type Status = 'good' | 'warn' | 'bad'

interface MetricProps {
  icon: string
  label: string
  value: string
  context: string
  status?: Status
}

const STATUS_DOT: Record<Status, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
}

function Metric({ icon, label, value, context, status = 'good' }: MetricProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#050b05] p-4">
      <div className="flex items-start justify-between">
        <span className="text-xl">{icon}</span>
        <span className={`mt-1 h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-400">{label}</div>
      <div className="mt-1 text-[11px] text-gray-600">{context}</div>
    </div>
  )
}

interface Props {
  weather: WeatherData
  forecast: ForecastData
  cropType: string
}

export default function WeatherCard({ weather, forecast, cropType }: Props) {
  const droughtStatus = weather.drought_status.toLowerCase()
  const isInDrought = droughtStatus.includes('drought') || droughtStatus.includes('dry')

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a160a] p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Weather Signals
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon="🌧️"
          label="Rainfall (90 days)"
          value={`${weather.total_precip_mm} mm`}
          context={weather.drought_status}
          status={isInDrought ? 'bad' : weather.total_precip_mm < 100 ? 'warn' : 'good'}
        />
        <Metric
          icon="🌡️"
          label="Heat stress days"
          value={`${weather.heat_stress_days} days`}
          context={`Above threshold for ${cropType}`}
          status={weather.heat_stress_days > 15 ? 'bad' : weather.heat_stress_days > 5 ? 'warn' : 'good'}
        />
        <Metric
          icon="💧"
          label="Water deficit"
          value={`${weather.water_deficit_mm} mm`}
          context="ET₀ minus total rainfall"
          status={weather.water_deficit_mm > 150 ? 'bad' : weather.water_deficit_mm > 75 ? 'warn' : 'good'}
        />
        <Metric
          icon="⛅"
          label="Forecast rainfall"
          value={`${forecast.total_precip_mm} mm`}
          context={`${forecast.days.length}-day outlook`}
          status={
            forecast.consecutive_dry_days > 10
              ? 'bad'
              : forecast.total_precip_mm < 10
                ? 'warn'
                : 'good'
          }
        />
      </div>
    </div>
  )
}
