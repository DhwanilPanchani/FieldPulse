#!/usr/bin/env python3
"""
FieldPulse Weather MCP Server
Exposes Open-Meteo climate history and forecast tools to Claude.

Data sources:
  Archive  : https://archive-api.open-meteo.com/v1/archive   (no auth)
  Forecast : https://api.open-meteo.com/v1/forecast          (no auth)
"""

import asyncio
import json
import logging
import math
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any

from dateutil.relativedelta import relativedelta
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

import cache as _cache_mod
from http_client import get_client
from rate_limiter import OPENMETEO_LIMITER
from validators import validate_coordinates

logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
logger = logging.getLogger("fieldpulse.weather")

_cache_mod.ensure_dirs()

ARCHIVE_URL  = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

ARCHIVE_DAILY_VARS = [
    "precipitation_sum", "temperature_2m_max", "temperature_2m_min",
    "temperature_2m_mean", "et0_fao_evapotranspiration", "wind_speed_10m_max",
]
FORECAST_DAILY_VARS = [
    "precipitation_sum", "temperature_2m_max", "temperature_2m_min",
    "et0_fao_evapotranspiration", "precipitation_probability_mean",
]

# ── SPI-3 ─────────────────────────────────────────────────────────────────────

def _compute_spi(monthly_precip: list[float], window: int = 3) -> list[float | None]:
    """
    Normal-distribution approximation of SPI for each month.
    McKee et al. (1993) AMS Proceedings.
    """
    n     = len(monthly_precip)
    spis: list[float | None] = [None] * n

    for i in range(window - 1, n):
        rolling_sum = sum(monthly_precip[i - window + 1: i + 1]) + 0.001 * window
        all_sums    = [
            sum(monthly_precip[j - window + 1: j + 1]) + 0.001 * window
            for j in range(window - 1, i + 1)
        ]
        if len(all_sums) < 4:
            spis[i] = None
            continue
        mu    = sum(all_sums) / len(all_sums)
        sigma = math.sqrt(sum((x - mu) ** 2 for x in all_sums) / len(all_sums))
        spis[i] = round((rolling_sum - mu) / sigma, 3) if sigma > 0.001 else 0.0

    return spis


def _classify_drought(spi3: float | None) -> str:
    if spi3 is None: return "unknown"
    if spi3 >= -0.5: return "none"
    if spi3 >= -1.0: return "mild"
    if spi3 >= -1.5: return "moderate"
    if spi3 >= -2.0: return "severe"
    return "extreme"


# ── aggregation helpers ───────────────────────────────────────────────────────

def _daily_to_monthly(
    dates: list[str], values: list[float | None], agg: str = "sum"
) -> dict[str, float | None]:
    monthly: dict[str, list] = {}
    for d_str, v in zip(dates, values):
        if v is None:
            continue
        monthly.setdefault(d_str[:7], []).append(v)
    result: dict[str, float | None] = {}
    for k, vals in monthly.items():
        if not vals:
            result[k] = None
        elif agg == "sum":
            result[k] = round(sum(vals), 2)
        elif agg == "mean":
            result[k] = round(sum(vals) / len(vals), 3)
    return result


def _count_heat_days_monthly(
    dates: list[str], tmax: list[float | None], threshold: float
) -> dict[str, int]:
    monthly: dict[str, int] = {}
    for d_str, t in zip(dates, tmax):
        if t is None: continue
        k = d_str[:7]
        monthly.setdefault(k, 0)
        if t >= threshold:
            monthly[k] += 1
    return monthly


# ── tool implementations ──────────────────────────────────────────────────────

async def _get_climate_history(lat: float, lon: float, months: int) -> dict:
    cache_key = f"hist_{lat:.4f}_{lon:.4f}_{months}"
    cached = _cache_mod.get(cache_key)
    if cached is not None:
        return cached

    today      = date.today()
    end_date   = today - timedelta(days=5)
    start_date = end_date - timedelta(days=30 * (months + 12))

    params = {
        "latitude":   lat, "longitude": lon,
        "start_date": start_date.isoformat(),
        "end_date":   end_date.isoformat(),
        "daily":      ",".join(ARCHIVE_DAILY_VARS),
        "timezone":   "auto",
    }

    async with get_client() as client:
        await OPENMETEO_LIMITER.acquire()
        r = await client.get(ARCHIVE_URL, params=params)
        r.raise_for_status()
        data = r.json()

    daily  = data.get("daily", {})
    dates  = daily.get("time", [])
    precip = daily.get("precipitation_sum", [])
    tmax   = daily.get("temperature_2m_max", [])
    tmean  = daily.get("temperature_2m_mean", [])
    et0    = daily.get("et0_fao_evapotranspiration", [])

    monthly_precip = _daily_to_monthly(dates, precip, "sum")
    monthly_tmax   = _daily_to_monthly(dates, tmax,   "mean")
    monthly_tmean  = _daily_to_monthly(dates, tmean,  "mean")
    monthly_et0    = _daily_to_monthly(dates, et0,    "sum")
    heat_30 = _count_heat_days_monthly(dates, tmax, 30.0)
    heat_35 = _count_heat_days_monthly(dates, tmax, 35.0)
    heat_40 = _count_heat_days_monthly(dates, tmax, 40.0)

    water_deficit = {
        m: round((monthly_et0.get(m) or 0) - (monthly_precip.get(m) or 0), 2)
        for m in monthly_precip
        if monthly_precip.get(m) is not None and monthly_et0.get(m) is not None
    }

    sorted_months = sorted(monthly_precip.keys())
    precip_series = [monthly_precip.get(m, 0.0) or 0.0 for m in sorted_months]
    spi3_series   = _compute_spi(precip_series, window=3)
    spi3_by_month = {m: spi3_series[i] for i, m in enumerate(sorted_months)}

    cutoff           = (end_date - timedelta(days=30 * months)).strftime("%Y-%m")
    months_in_window = [m for m in sorted_months if m >= cutoff]

    result: dict = {"lat": lat, "lon": lon, "monthly_data": {}}
    for month in months_in_window:
        result["monthly_data"][month] = {
            "precip_mm":            monthly_precip.get(month),
            "tmax_mean_c":          monthly_tmax.get(month),
            "tmean_c":              monthly_tmean.get(month),
            "et0_mm":               monthly_et0.get(month),
            "water_deficit_mm":     water_deficit.get(month),
            "heat_stress_days_30":  heat_30.get(month, 0),
            "heat_stress_days_35":  heat_35.get(month, 0),
            "heat_stress_days_40":  heat_40.get(month, 0),
            "spi3":                 spi3_by_month.get(month),
            "drought_class":        _classify_drought(spi3_by_month.get(month)),
        }

    precip_vals  = [v["precip_mm"]           for v in result["monthly_data"].values() if v["precip_mm"]           is not None]
    spi3_vals    = [v["spi3"]                for v in result["monthly_data"].values() if v["spi3"]                is not None]
    heat35_vals  = [v["heat_stress_days_35"] for v in result["monthly_data"].values()]
    deficit_vals = [v["water_deficit_mm"]    for v in result["monthly_data"].values() if v["water_deficit_mm"]    is not None]

    last_spi3 = spi3_by_month.get(sorted(spi3_by_month.keys())[-1]) if spi3_by_month else None
    result["summary"] = {
        "total_precip_mm":           round(sum(precip_vals), 1) if precip_vals else None,
        "mean_spi3":                 round(sum(spi3_vals) / len(spi3_vals), 3) if spi3_vals else None,
        "current_spi3":              last_spi3,
        "total_heat_stress_35":      sum(heat35_vals),
        "total_water_deficit_mm":    round(sum(deficit_vals), 1) if deficit_vals else None,
        "drought_status":            _classify_drought(last_spi3),
        "data_completeness_pct":     round(len(precip_vals) / max(len(months_in_window), 1) * 100),
    }

    _cache_mod.set(cache_key, result, ttl_seconds=86400)
    return result


async def _get_forecast(lat: float, lon: float, days: int) -> dict:
    cache_key = f"fcst_{lat:.4f}_{lon:.4f}_{days}"
    cached = _cache_mod.get(cache_key)
    if cached is not None:
        return cached

    forecast_days = min(days, 16)
    params = {
        "latitude": lat, "longitude": lon,
        "daily":         ",".join(FORECAST_DAILY_VARS),
        "forecast_days": forecast_days,
        "timezone":      "auto",
    }

    async with get_client() as client:
        await OPENMETEO_LIMITER.acquire()
        r = await client.get(FORECAST_URL, params=params)
        r.raise_for_status()
        data = r.json()

    daily      = data.get("daily", {})
    dates      = daily.get("time", [])
    precip     = daily.get("precipitation_sum", [])
    tmax       = daily.get("temperature_2m_max", [])
    tmin       = daily.get("temperature_2m_min", [])
    et0        = daily.get("et0_fao_evapotranspiration", [])
    precip_prob= daily.get("precipitation_probability_mean", [])

    daily_out = []
    for i, d in enumerate(dates):
        _tmax = tmax[i]   if i < len(tmax)   else None
        _et0  = et0[i]    if i < len(et0)    else None
        _p    = precip[i] if i < len(precip) else None
        daily_out.append({
            "date":            d,
            "precip_mm":       _p,
            "tmax_c":          _tmax,
            "tmin_c":          tmin[i] if i < len(tmin) else None,
            "et0_mm":          _et0,
            "precip_prob_pct": precip_prob[i] if i < len(precip_prob) else None,
            "heat_stress_35":  (_tmax >= 35.0) if _tmax is not None else False,
            "heat_stress_40":  (_tmax >= 40.0) if _tmax is not None else False,
            "water_deficit_mm":round((_et0 or 0) - (_p or 0), 2) if _et0 is not None else None,
        })

    total_p   = sum(v for v in precip if v is not None)
    total_et0 = sum(v for v in et0    if v is not None)
    h35_count = sum(1 for v in tmax if v is not None and v >= 35.0)
    h40_count = sum(1 for v in tmax if v is not None and v >= 40.0)
    total_def = round(total_et0 - total_p, 1)
    valid_tmax = [v for v in tmax if v is not None]
    mean_tmax = round(sum(valid_tmax) / len(valid_tmax), 2) if valid_tmax else None

    stress = "low"
    if h35_count >= 7 or total_def > 80: stress = "critical"
    elif h35_count >= 3 or total_def > 40: stress = "high"
    elif h35_count >= 1 or total_def > 15: stress = "medium"

    result = {
        "lat": lat, "lon": lon,
        "forecast_days": forecast_days,
        "note": "Open-Meteo free tier: 16-day deterministic forecast only. Days 17-30 require trend extrapolation." if days > 16 else None,
        "daily": daily_out,
        "summary": {
            "total_precip_mm":        round(total_p, 1),
            "total_et0_mm":           round(total_et0, 1),
            "total_water_deficit_mm": total_def,
            "mean_tmax_c":            mean_tmax,
            "heat_stress_days_35":    h35_count,
            "heat_stress_days_40":    h40_count,
            "stress_forecast":        stress,
        },
    }

    _cache_mod.set(cache_key, result, ttl_seconds=10800)
    return result


# ── MCP server ────────────────────────────────────────────────────────────────

server = Server("fieldpulse-weather")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_climate_history",
            description="Fetch Open-Meteo historical climate data with monthly SPI-3 and heat stress counts.",
            inputSchema={
                "type": "object",
                "properties": {
                    "lat":    {"type": "number",  "description": "Latitude"},
                    "lon":    {"type": "number",  "description": "Longitude"},
                    "months": {"type": "integer", "description": "History months (1–24)"},
                },
                "required": ["lat", "lon"],
            },
        ),
        Tool(
            name="get_forecast",
            description="Fetch Open-Meteo 16-day forecast with heat stress projections.",
            inputSchema={
                "type": "object",
                "properties": {
                    "lat":  {"type": "number",  "description": "Latitude"},
                    "lon":  {"type": "number",  "description": "Longitude"},
                    "days": {"type": "integer", "description": "Forecast days (1–16)"},
                },
                "required": ["lat", "lon"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    try:
        # ── VALIDATION FIRST ─────────────────────────────────────────────────
        lat  = float(arguments["lat"])
        lon  = float(arguments["lon"])
        validate_coordinates(lat, lon)

        if name == "get_climate_history":
            months = min(int(arguments.get("months", 12)), 24)
            result = await _get_climate_history(lat, lon, months)
        elif name == "get_forecast":
            days = min(int(arguments.get("days", 16)), 16)
            result = await _get_forecast(lat, lon, days)
        else:
            result = {"error": "unknown_tool", "message": f"Unknown tool: {name}", "tool": name}

    except ValueError as e:
        result = {
            "error": "input_validation_error",
            "message": str(e),
            "tool": name,
            "recoverable": False,
            "fallback_available": False,
        }
    except Exception as e:
        import httpx
        if isinstance(e, httpx.TimeoutException):
            result = {
                "error": "api_timeout",
                "message": "Open-Meteo API timed out after 25 s.",
                "tool": name,
                "recoverable": True,
                "fallback_available": False,
            }
        elif isinstance(e, httpx.HTTPStatusError):
            result = {
                "error": "api_http_error",
                "message": f"Open-Meteo returned HTTP {e.response.status_code}",
                "tool": name,
                "recoverable": True,
                "fallback_available": False,
            }
        else:
            logger.error("Unexpected error in %s: %s: %s", name, type(e).__name__, e)
            result = {
                "error": "unexpected_error",
                "message": "An unexpected error occurred. Check ~/.fieldpulse/logs/.",
                "tool": name,
                "recoverable": False,
                "fallback_available": False,
            }

    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def main():
    async with stdio_server() as streams:
        await server.run(streams[0], streams[1], server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
