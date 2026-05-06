'use client'

import type { ForecastDay } from '@/lib/types'

interface Props {
  days: ForecastDay[]
  heatThreshold: number
}

const PAD = { top: 20, right: 52, bottom: 36, left: 44 }
const W = 800
const H = 180

export default function ForecastChart({ days, heatThreshold }: Props) {
  if (days.length === 0) return null

  const maxPrecip = Math.max(...days.map((d) => d.precip), 10)
  const maxTemp = Math.max(...days.map((d) => d.tmax), heatThreshold + 5)
  const minTemp = Math.min(...days.map((d) => d.tmax), 10)

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const barW = innerW / days.length

  function xPos(i: number) {
    return PAD.left + i * barW + barW * 0.1
  }

  function precipY(val: number) {
    return PAD.top + innerH - (val / maxPrecip) * innerH
  }

  function tempY(val: number) {
    return PAD.top + innerH - ((val - minTemp) / Math.max(maxTemp - minTemp, 1)) * innerH
  }

  const thresholdY = tempY(heatThreshold)

  const tempPoints = days
    .map((d, i) => `${xPos(i) + barW * 0.4},${tempY(d.tmax)}`)
    .join(' ')

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a160a] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          16-Day Forecast
        </h2>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3 rounded-sm bg-blue-500/70" />
            Precip (mm)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-orange-400" />
            Max temp (°C)
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 180 }}
        aria-label="16-day weather forecast chart"
      >
        {/* Subtle grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            y1={PAD.top + innerH * f}
            x2={W - PAD.right}
            y2={PAD.top + innerH * f}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Heat threshold dashed line */}
        <line
          x1={PAD.left}
          y1={thresholdY}
          x2={W - PAD.right}
          y2={thresholdY}
          stroke="#f97316"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        <text x={W - PAD.right + 4} y={thresholdY + 4} fontSize="9" fill="#f97316" opacity="0.8">
          {heatThreshold}°
        </text>

        {/* Precip bars */}
        {days.map((d, i) => {
          const bH = (d.precip / maxPrecip) * innerH
          return (
            <rect
              key={d.date}
              x={xPos(i)}
              y={precipY(d.precip)}
              width={barW * 0.8}
              height={Math.max(bH, 0)}
              fill="#1d4ed8"
              rx="2"
              opacity="0.75"
            />
          )
        })}

        {/* Temp line */}
        <polyline
          points={tempPoints}
          fill="none"
          stroke="#f97316"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Temp dots — highlight heat-stress days */}
        {days.map((d, i) => (
          <circle
            key={d.date}
            cx={xPos(i) + barW * 0.4}
            cy={tempY(d.tmax)}
            r="2.5"
            fill={d.tmax >= heatThreshold ? '#ef4444' : '#f97316'}
          />
        ))}

        {/* X-axis labels every 4 days */}
        {days.map((d, i) => {
          if (i % 4 !== 0) return null
          return (
            <text
              key={d.date}
              x={xPos(i) + barW * 0.4}
              y={H - 6}
              fontSize="9"
              fill="#6b7280"
              textAnchor="middle"
            >
              {d.date.slice(5)}
            </text>
          )
        })}

        {/* Y-axis labels */}
        <text
          x={PAD.left - 6}
          y={PAD.top + innerH / 2}
          fontSize="9"
          fill="#6b7280"
          textAnchor="middle"
          transform={`rotate(-90, ${PAD.left - 6}, ${PAD.top + innerH / 2})`}
        >
          mm
        </text>
        <text
          x={W - PAD.right + 36}
          y={PAD.top + innerH / 2}
          fontSize="9"
          fill="#6b7280"
          textAnchor="middle"
          transform={`rotate(90, ${W - PAD.right + 36}, ${PAD.top + innerH / 2})`}
        >
          °C
        </text>
      </svg>
    </div>
  )
}
