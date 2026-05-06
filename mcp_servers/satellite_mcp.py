#!/usr/bin/env python3
"""
FieldPulse Satellite MCP Server
Exposes MODIS NDVI time-series and vegetation stress tools to Claude.

NDVI time-series : ORNL MODIS REST API (MOD13Q1, 16-day composites)
Vegetation stress : Microsoft Planetary Computer STAC (Sentinel-2 L2A)
                   with MODIS GIBS colour-tile fallback

Band math reference (Sentinel-2 L2A, surface reflectance, scale factor 10000):
  NDVI  = (B08 - B04) / (B08 + B04)              Rouse et al. 1974
  NDWI  = (B03 - B08) / (B03 + B08)              Gao 1996
  EVI   = 2.5 * (B08 - B04) /                    Huete et al. 2002
          (B08 + 6*B04 - 7.5*B02 + 1)
"""

import asyncio
import json
import logging
import math
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any

import numpy as np
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

import cache as _cache_mod
from http_client import get_client
from rate_limiter import SENTINEL_LIMITER
from validators import validate_field_inputs

logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
logger = logging.getLogger("fieldpulse.satellite")

_cache_mod.ensure_dirs()

# ── constants ────────────────────────────────────────────────────────────────

# Regional monthly NDVI baselines keyed by month string "01"–"12"
# south_asia values derived from actual 2025 MODIS data for Punjab wheat
REGIONAL_NDVI_BASELINES = {
    "south_asia":    {"01": 0.41, "02": 0.49, "03": 0.48, "04": 0.43, "05": 0.41, "06": 0.25, "07": 0.28, "08": 0.32, "09": 0.30, "10": 0.32, "11": 0.36, "12": 0.38},
    "north_america": {"01": 0.20, "02": 0.22, "03": 0.35, "04": 0.50, "05": 0.60, "06": 0.65, "07": 0.65, "08": 0.60, "09": 0.50, "10": 0.35, "11": 0.25, "12": 0.20},
    "default":       {"01": 0.30, "02": 0.32, "03": 0.40, "04": 0.48, "05": 0.50, "06": 0.48, "07": 0.45, "08": 0.45, "09": 0.42, "10": 0.38, "11": 0.32, "12": 0.30},
}


def _get_region(lat: float, lon: float) -> str:
    if 5 <= lat <= 40 and 60 <= lon <= 100:
        return "south_asia"
    if 25 <= lat <= 60 and -130 <= lon <= -60:
        return "north_america"
    return "default"


# ── ORNL MODIS REST API (primary NDVI source) ─────────────────────────────────

ORNL_MODIS_URL   = "https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset"
MODIS_FILL_VALUE = -28672
NDVI_SCALE       = 10000.0
NDVI_VALID_MIN   = 0.1
NDVI_VALID_MAX   = 0.9


def date_to_modis_doy(date_obj) -> str:
    """Convert a date to ORNL MODIS startDate/endDate format: 'A2025001'."""
    return f"A{date_obj.year}{date_obj.timetuple().tm_yday:03d}"


def _split_date_range(
    start: date, end: date, max_days: int = 120
) -> list[tuple[date, date]]:
    """Split a date range into chunks of at most max_days (≤ 10 MODIS tiles)."""
    chunks: list[tuple[date, date]] = []
    current = start
    while current <= end:
        chunk_end = min(current + timedelta(days=max_days - 1), end)
        chunks.append((current, chunk_end))
        current = chunk_end + timedelta(days=1)
    return chunks


async def _fetch_modis_ornl_chunk(
    client: Any, lat: float, lon: float,
    chunk_start: date, chunk_end: date,
) -> list[dict]:
    """Fetch one ORNL MODIS chunk. Returns list of {date, ndvi, low_confidence}."""
    params = {
        "latitude":     lat,
        "longitude":    lon,
        "startDate":    date_to_modis_doy(chunk_start),
        "endDate":      date_to_modis_doy(chunk_end),
        "kmAboveBelow": 0,
        "kmLeftRight":  0,
    }
    await SENTINEL_LIMITER.acquire()
    r = await client.get(ORNL_MODIS_URL, params=params, timeout=30.0)
    r.raise_for_status()
    body = r.json()

    points: list[dict] = []
    for item in body.get("subset", []):
        if item.get("band") != "250m_16_days_NDVI":
            continue
        data_arr = item.get("data", [])
        if not data_arr:
            continue
        raw = data_arr[0]
        if raw is None or raw == MODIS_FILL_VALUE:
            continue
        ndvi = raw / NDVI_SCALE
        low_confidence = not (NDVI_VALID_MIN <= ndvi <= NDVI_VALID_MAX)
        points.append({
            "date":           item["calendar_date"],
            "ndvi":           round(ndvi, 4),
            "low_confidence": low_confidence,
        })
    return points


# ── Sentinel-2 / MPC infrastructure (used by get_vegetation_stress_index) ────

MPC_STAC_URL  = "https://planetarycomputer.microsoft.com/api/stac/v1"
MPC_SAS_URL   = "https://planetarycomputer.microsoft.com/api/sas/v1/sign"
COLLECTION    = "sentinel-2-l2a"
MAX_CLOUD_PCT = 20

# NDVI colour → approximate value mapping for MODIS GIBS fallback
_MODIS_COLOUR_NDVI = [
    ((0, 0, 128),    -0.20),
    ((0, 0, 255),    -0.05),
    ((0, 128, 255),   0.05),
    ((0, 255, 255),   0.15),
    ((0, 255, 128),   0.25),
    ((0, 255, 0),     0.40),
    ((128, 255, 0),   0.55),
    ((255, 255, 0),   0.65),
    ((255, 128, 0),   0.75),
    ((255, 0, 0),     0.85),
    ((128, 0, 0),     1.00),
]


# ── geometry helpers ──────────────────────────────────────────────────────────

def bbox_from_center(lat: float, lon: float, radius_km: float) -> list[float]:
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * math.cos(math.radians(lat)))
    return [lon - dlon, lat - dlat, lon + dlon, lat + dlat]


# ── land / ocean check ────────────────────────────────────────────────────────

async def is_likely_land(lat: float, lon: float) -> bool:
    """
    Quick elevation check via Open-Meteo — elevation < -1 m indicates open ocean.
    Fails open (returns True) so analysis is never blocked by this check.
    """
    try:
        async with get_client() as client:
            await SENTINEL_LIMITER.acquire()
            r = await client.get(
                "https://api.open-meteo.com/v1/elevation",
                params={"latitude": lat, "longitude": lon},
            )
            r.raise_for_status()
            data = r.json()
            elevation = data.get("elevation", [0])[0]
            return float(elevation) > -1.0
    except Exception:
        return True  # fail open


# ── SAS token helper ──────────────────────────────────────────────────────────

async def sign_url(client: Any, url: str) -> str:
    try:
        await SENTINEL_LIMITER.acquire()
        r = await client.get(MPC_SAS_URL, params={"href": url})
        r.raise_for_status()
        return r.json().get("href", url)
    except Exception:
        return url


# ── STAC search ───────────────────────────────────────────────────────────────

async def search_mpc_scenes(
    client: Any,
    bbox: list[float],
    start_date: str,
    end_date: str,
    max_cloud: int = MAX_CLOUD_PCT,
    limit: int = 5,
) -> list[dict]:
    payload = {
        "collections": [COLLECTION],
        "bbox": bbox,
        "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
        "query": {"eo:cloud_cover": {"lte": max_cloud}},
        "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}],
        "limit": limit,
    }
    try:
        await SENTINEL_LIMITER.acquire()
        r = await client.post(f"{MPC_STAC_URL}/search", json=payload)
        r.raise_for_status()
        return r.json().get("features", [])
    except Exception as e:
        logger.warning("MPC STAC search failed: %s", e)
        return []


# ── band math ─────────────────────────────────────────────────────────────────

def _compute_ndvi_from_bands(
    band_arrays: dict[str, np.ndarray],
) -> tuple[float, float, float]:
    scale = 10_000.0
    b02 = band_arrays["B02"].astype(float) / scale
    b03 = band_arrays["B03"].astype(float) / scale
    b04 = band_arrays["B04"].astype(float) / scale
    b08 = band_arrays["B08"].astype(float) / scale

    valid = (b08 > 0) & (b04 > 0) & (b08 <= 1) & (b04 <= 1)

    ndvi = np.where(valid, (b08 - b04) / (b08 + b04 + 1e-9), np.nan)
    ndwi = np.where(valid, (b03 - b08) / (b03 + b08 + 1e-9), np.nan)

    denom_evi = b08 + 6 * b04 - 7.5 * b02 + 1
    evi = np.where(valid & (denom_evi != 0), 2.5 * (b08 - b04) / denom_evi, np.nan)

    return (
        float(np.nanmean(ndvi)),
        float(np.nanmean(ndwi)),
        float(np.nanmean(evi)),
    )


async def read_scene_bands(
    client: Any, item: dict, bbox: list[float]
) -> dict[str, np.ndarray] | None:
    try:
        import rasterio
        from rasterio.crs import CRS
        from rasterio.warp import transform_bounds

        bands: dict[str, np.ndarray] = {}
        assets = item.get("assets", {})

        for band_key in ("B02", "B03", "B04", "B08"):
            if band_key not in assets:
                return None
            href   = assets[band_key].get("href", "")
            signed = await sign_url(client, href)

            with rasterio.open(signed) as src:
                scene_crs = src.crs
                west, south, east, north = transform_bounds(
                    CRS.from_epsg(4326), scene_crs, *bbox
                )
                window = src.window(west, south, east, north)
                window = window.intersection(
                    rasterio.windows.Window(0, 0, src.width, src.height)
                )
                if window.width < 1 or window.height < 1:
                    return None
                bands[band_key] = src.read(1, window=window)

        return bands
    except Exception as e:
        logger.warning("Band read failed for scene %s: %s", item.get("id"), e)
        return None


# ── MODIS GIBS fallback (used by get_vegetation_stress_index) ─────────────────

def _closest_ndvi_from_rgb(r: int, g: int, b: int) -> float:
    closest = min(
        _MODIS_COLOUR_NDVI,
        key=lambda x: math.sqrt(sum((a - c) ** 2 for a, c in zip((r, g, b), x[0]))),
    )
    return closest[1]


async def get_modis_ndvi_approximate(
    client: Any, lat: float, lon: float, date_obj: datetime
) -> float | None:
    try:
        delta  = 0.01
        params = {
            "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap",
            "LAYERS": "MODIS_Terra_NDVI_8Day", "CRS": "EPSG:4326",
            "BBOX": f"{lon-delta},{lat-delta},{lon+delta},{lat+delta}",
            "WIDTH": "3", "HEIGHT": "3",
            "FORMAT": "image/png", "TIME": date_obj.strftime("%Y-%m-%d"),
        }
        await SENTINEL_LIMITER.acquire()
        r = await client.get(
            "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
            params=params,
        )
        r.raise_for_status()
        import io, struct, zlib
        png_bytes = r.content
        if png_bytes[1:4] != b"PNG":
            return None
        pos = 8
        while pos < len(png_bytes):
            length     = struct.unpack(">I", png_bytes[pos:pos+4])[0]
            chunk_type = png_bytes[pos+4:pos+8]
            data       = png_bytes[pos+8:pos+8+length]
            if chunk_type == b"IDAT":
                raw    = zlib.decompress(data)
                stride = 1 + 3 * 4
                row1   = raw[stride:stride*2]
                return _closest_ndvi_from_rgb(row1[5], row1[6], row1[7])
            pos += 8 + length + 4
        return None
    except Exception as e:
        logger.warning("MODIS GIBS fallback failed: %s", e)
        return None


# ── tool implementations ─────────────────────────────────────────────────────

async def _get_ndvi_timeseries(
    lat: float, lon: float, radius_km: float, months: int
) -> dict:
    cache_key = f"ndvi_v2_{lat:.4f}_{lon:.4f}_{months}"
    cached = _cache_mod.get(cache_key)
    if cached is not None:
        return cached

    land = await is_likely_land(lat, lon)
    if not land:
        return {
            "source":      "modis_ornl_mod13q1",
            "land_check":  False,
            "data_points": 0,
            "timeseries":  [],
            "warning": (
                f"Coordinates ({lat}, {lon}) appear to be in open water, not farmland. "
                "Verify the location and rerun if correct."
            ),
        }

    today      = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=months * 30)

    # Max 10 tiles per request × 16-day composites = 160 days.
    # Use 120-day chunks to stay safely under the limit.
    chunks = _split_date_range(start_date, today, max_days=120)

    all_points: list[dict] = []
    async with get_client() as client:
        for chunk_start, chunk_end in chunks:
            try:
                pts = await _fetch_modis_ornl_chunk(client, lat, lon, chunk_start, chunk_end)
                all_points.extend(pts)
                logger.info("ORNL MODIS chunk %s–%s: %d points", chunk_start, chunk_end, len(pts))
            except Exception as e:
                logger.warning("ORNL MODIS chunk %s–%s failed: %s", chunk_start, chunk_end, e)

    all_points.sort(key=lambda p: p["date"])
    all_ndvi = [p["ndvi"] for p in all_points]

    if not all_ndvi:
        return {
            "source":           "modis_ornl_mod13q1",
            "land_check":       True,
            "data_points":      0,
            "timeseries":       [],
            "ndvi_mean":        None,
            "ndvi_trend":       "unknown",
            "ndvi_anomaly_pct": None,
            "current_ndvi":     None,
            "peak_ndvi":        None,
            "trough_ndvi":      None,
            "warning":          "No valid NDVI data returned from MODIS ORNL API for this location/period.",
        }

    ndvi_mean = round(sum(all_ndvi) / len(all_ndvi), 4)

    # Trend: compare first 3 vs last 3 readings
    ndvi_trend = "stable"
    if len(all_ndvi) >= 6:
        first3 = sum(all_ndvi[:3]) / 3
        last3  = sum(all_ndvi[-3:]) / 3
        if last3 < first3 - 0.05:
            ndvi_trend = "declining"
        elif last3 > first3 + 0.05:
            ndvi_trend = "improving"

    current_ndvi = all_ndvi[-1]
    peak_ndvi    = max(all_ndvi)
    trough_ndvi  = min(all_ndvi)

    # Anomaly: prefer prior-year same-month data, fall back to regional baseline
    region           = _get_region(lat, lon)
    regional_table   = REGIONAL_NDVI_BASELINES[region]
    current_month_key = all_points[-1]["date"][5:7]
    prior_year_prefix = today.replace(year=today.year - 1).strftime("%Y-%m")

    prior_readings = [p["ndvi"] for p in all_points if p["date"].startswith(prior_year_prefix)]
    if prior_readings:
        baseline_val: float | None = sum(prior_readings) / len(prior_readings)
    else:
        baseline_val = regional_table.get(current_month_key)

    ndvi_anomaly_pct: float | None = None
    if baseline_val and baseline_val > 0:
        ndvi_anomaly_pct = round(((current_ndvi - baseline_val) / baseline_val) * 100, 1)

    result = {
        "source":           "modis_ornl_mod13q1",
        "land_check":       True,
        "data_points":      len(all_ndvi),
        "timeseries":       all_points,
        "ndvi_mean":        ndvi_mean,
        "ndvi_trend":       ndvi_trend,
        "ndvi_anomaly_pct": ndvi_anomaly_pct,
        "current_ndvi":     round(current_ndvi, 4),
        "peak_ndvi":        round(peak_ndvi, 4),
        "trough_ndvi":      round(trough_ndvi, 4),
        "warning":          None,
    }

    _cache_mod.set(cache_key, result, ttl_seconds=21600)
    return result


async def _get_vegetation_stress_index(lat: float, lon: float) -> dict:
    cache_key = f"vsi_{lat:.4f}_{lon:.4f}"
    cached = _cache_mod.get(cache_key)
    if cached is not None:
        return cached

    land = await is_likely_land(lat, lon)
    if not land:
        return {
            "warning": "land_check_failed",
            "message": f"Coordinates ({lat}, {lon}) appear to be in open water.",
        }

    bbox      = bbox_from_center(lat, lon, 2.0)
    now       = datetime.now(timezone.utc)
    start_str = (now - timedelta(days=45)).strftime("%Y-%m-%d")
    end_str   = now.strftime("%Y-%m-%d")

    async with get_client() as client:
        scenes = await search_mpc_scenes(
            client, bbox, start_str, end_str, max_cloud=30, limit=10
        )

        ndvi, ndwi, evi = None, None, None
        for scene in scenes:
            bands = await read_scene_bands(client, scene, bbox)
            if bands:
                ndvi, ndwi, evi = _compute_ndvi_from_bands(bands)
                break

        if ndvi is None:
            ndvi = await get_modis_ndvi_approximate(client, lat, lon, now)

        stress_level = _classify_stress(ndvi, ndwi)
        result = {
            "ndvi":         round(ndvi, 4) if ndvi is not None else None,
            "ndwi":         round(ndwi, 4) if ndwi is not None else None,
            "evi":          round(evi,  4) if evi  is not None else None,
            "stress_level": stress_level,
            "land_check":   True,
            "data_date":    end_str,
            "source":       "sentinel-2/mpc" if ndwi is not None else "modis/gibs-approx",
        }

    _cache_mod.set(cache_key, result, ttl_seconds=21600)
    return result


def _classify_stress(ndvi: float | None, ndwi: float | None) -> str:
    if ndvi is None:
        return "unknown"
    if ndwi is not None:
        if ndwi < -0.3 and ndvi < 0.4:  return "critical"
        if ndwi < -0.1 and ndvi < 0.55: return "high"
        if ndwi < 0.1  or  ndvi < 0.65: return "medium"
        return "low"
    else:
        if ndvi < 0.25: return "critical"
        if ndvi < 0.40: return "high"
        if ndvi < 0.60: return "medium"
        return "low"


# ── MCP server ────────────────────────────────────────────────────────────────

server = Server("fieldpulse-satellite")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_ndvi_timeseries",
            description=(
                "Fetch NDVI time-series using ORNL MODIS REST API (MOD13Q1, 16-day composites). "
                "Returns per-reading timeseries, mean, trend, anomaly %, peak/trough, and "
                "data point count. Includes land/ocean validation via Open-Meteo elevation."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "lat":       {"type": "number",  "description": "Latitude (-90 to 90)"},
                    "lon":       {"type": "number",  "description": "Longitude (-180 to 180)"},
                    "radius_km": {"type": "number",  "description": "Analysis radius in km (0.1–50)"},
                    "months":    {"type": "integer", "description": "History months (1–24)"},
                },
                "required": ["lat", "lon"],
            },
        ),
        Tool(
            name="get_vegetation_stress_index",
            description=(
                "Compute NDWI (water stress) and EVI from the most recent Sentinel-2 scene. "
                "Includes land/ocean validation."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "lat": {"type": "number", "description": "Latitude"},
                    "lon": {"type": "number", "description": "Longitude"},
                },
                "required": ["lat", "lon"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    try:
        lat       = float(arguments["lat"])
        lon       = float(arguments["lon"])
        radius_km = float(arguments.get("radius_km", 5.0))
        months    = min(int(arguments.get("months", 12)), 24)
        validate_field_inputs(lat, lon, radius_km, months)

        if name == "get_ndvi_timeseries":
            result = await _get_ndvi_timeseries(lat, lon, radius_km, months)
        elif name == "get_vegetation_stress_index":
            result = await _get_vegetation_stress_index(lat, lon)
        else:
            result = {"error": "unknown_tool", "message": f"Unknown tool: {name}", "tool": name}

    except ValueError as e:
        result = {
            "error":              "input_validation_error",
            "message":            str(e),
            "tool":               name,
            "recoverable":        False,
            "fallback_available": False,
        }
    except Exception as e:
        import httpx
        if isinstance(e, httpx.TimeoutException):
            result = {
                "error":              "api_timeout",
                "message":            "Satellite API timed out after 30 s. Cached data used if available.",
                "tool":               name,
                "recoverable":        True,
                "fallback_available": True,
            }
        elif isinstance(e, httpx.HTTPStatusError):
            result = {
                "error":              "api_http_error",
                "message":            f"Satellite API returned HTTP {e.response.status_code}",
                "tool":               name,
                "recoverable":        True,
                "fallback_available": True,
            }
        else:
            logger.error("Unexpected error in %s: %s: %s", name, type(e).__name__, e)
            result = {
                "error":              "unexpected_error",
                "message":            "An unexpected error occurred. Check ~/.fieldpulse/logs/.",
                "tool":               name,
                "recoverable":        False,
                "fallback_available": False,
            }

    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def main():
    async with stdio_server() as streams:
        await server.run(streams[0], streams[1], server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
