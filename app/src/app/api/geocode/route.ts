import { NextRequest, NextResponse } from 'next/server'
import type { GeocodeResult } from '@/lib/types'

interface OpenMeteoGeoResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

interface OpenMeteoGeoResponse {
  results?: OpenMeteoGeoResult[]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const location = request.nextUrl.searchParams.get('location')?.trim()

  if (!location) {
    return NextResponse.json({ error: 'location parameter required' }, { status: 400 })
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoding service error' }, { status: 502 })
    }

    const data = (await res.json()) as OpenMeteoGeoResponse

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const r = data.results[0]
    const display_name = r.admin1 ? `${r.name}, ${r.admin1}, ${r.country}` : `${r.name}, ${r.country}`

    const result: GeocodeResult = {
      lat: r.latitude,
      lon: r.longitude,
      display_name,
      country: r.country,
    }

    return NextResponse.json(result)
  } catch {
    clearTimeout(timer)
    return NextResponse.json({ error: 'Geocoding request timed out' }, { status: 504 })
  }
}
