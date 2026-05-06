'use client'

import type { ForecastDay } from '@/lib/types'

interface Props {
  days: ForecastDay[]
  heatThreshold: number
}

const PAD = { top: 16, right: 48, bottom: 32, left: 40 }
const W = 800
const H = 160

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
    return PAD.top + innerH - ((val - minTemp) / (maxTemp - minTemp)) * innerH
  }

  const thresholdY = tempY(heatThreshold)

  const tempPoints = days
    .map((d, i) => `${xPos(i) + barW * 0.4},${tempY(d.tmax)}`)
    .join(' ')

  return (
    <div className="rounded-2xl bg-[#1a1d27] p-6 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
          16-Day Forecast
        </h2>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[#0077b6]" /> Precip (mm)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-[#e76f51]" /> Max temp (°C)
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 160 }}
        aria-label="16-day forecast chart"
      >
        {/* Heat threshold dashed line */}
        <line
          x1={PAD.left}
          y1={thresholdY}
          x2={W - PAD.right}
          y2={thresholdY}
          stroke="#e76f51"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.5"
        />
        <text x={W - PAD.right + 4} y={thresholdY + 4} fontSize="9" fill="#e76f51" opacity="0.7">
          {heatThreshold}°
        </text>

        {/* Precip bars */}
        {days.map((d, i) => {
          const bH = (d.precip / maxPrecip) * innerH
          return (
            <rect
              key={d.date}
              x={xPos(i)}
              y={PAD.top + innerH - bH}
              width={barW * 0.8}
              height={Math.max(bH, 0)}
              fill="#0077b6"
              opacity="0.7"
              rx="1"
            />
          )
        })}

        {/* Temp line */}
        <polyline
          points={tempPoints}
          fill="none"
          stroke="#e76f51"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* X-axis labels every 4 days */}
        {days.map((d, i) => {
          if (i % 4 !== 0) return null
          const label = d.date.slice(5) // MM-DD
          return (
            <text
              key={d.date}
              x={xPos(i) + barW * 0.4}
              y={H - 4}
              fontSize="9"
              fill="#6b7280"
              textAnchor="middle"
            >
              {label}
            </text>
          )
        })}

        {/* Y left label */}
        <text
          x={PAD.left - 4}
          y={PAD.top + innerH / 2}
          fontSize="9"
          fill="#6b7280"
          textAnchor="middle"
          transform={`rotate(-90, ${PAD.left - 4}, ${PAD.top + innerH / 2})`}
        >
          mm
        </text>

        {/* Y right label */}
        <text
          x={W - PAD.right + 32}
          y={PAD.top + innerH / 2}
          fontSize="9"
          fill="#6b7280"
          textAnchor="middle"
          transform={`rotate(90, ${W - PAD.right + 32}, ${PAD.top + innerH / 2})`}
        >
          °C
        </text>
      </svg>
    </div>
  )
}
