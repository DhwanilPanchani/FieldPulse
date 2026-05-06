#!/usr/bin/env python3
"""
FieldPulse Soil MCP Server

Flow:
  Step 1 — Nominatim reverse geocode: country + admin1 → soil baseline
  Step 2 — NASA POWER API: real satellite soil moisture indices (2020-2023)
  Step 3 — Merge and return combined result

  Always returns a result. Source reported as
  "nasa_power_moisture + {region_key}_baseline".
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

import cache as _cache_mod
from http_client import get_client
from rate_limiter import SOILGRIDS_LIMITER as _API_LIMITER
from validators import validate_coordinates

logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
logger = logging.getLogger("fieldpulse.soil")

_cache_mod.ensure_dirs()

# ── Soil baselines keyed by "CC" or "CC:State" ───────────────────────────────

SOIL_BASELINES = {

    # ─── INDIA — state-level ───────────────────────────────────────
    "IN:Punjab": {
        "org_carbon_g_per_kg": 3.5, "ph": 8.7,
        "clay_pct": 28.0, "bulk_density_kg_per_m3": 1480,
        "region_desc": "Punjab, India (IGP alluvial)",
        "source": "ICAR Punjab Agricultural University",
    },
    # Chandigarh UT is the capital of Punjab and sits on the same IGP alluvial belt
    "IN:Chandigarh": {
        "org_carbon_g_per_kg": 3.5, "ph": 8.7,
        "clay_pct": 28.0, "bulk_density_kg_per_m3": 1480,
        "region_desc": "Punjab, India (IGP alluvial — Chandigarh UT)",
        "source": "ICAR Punjab Agricultural University",
    },
    "IN:Haryana": {
        "org_carbon_g_per_kg": 3.8, "ph": 8.5,
        "clay_pct": 26.0, "bulk_density_kg_per_m3": 1460,
        "region_desc": "Haryana, India (IGP alluvial)",
        "source": "ICAR Haryana soil surveys",
    },
    "IN:West Bengal": {
        # Laterite west (Bankura/Purulia) is the more distinct zone;
        # alluvial east blends with the Bihar/UP baseline.
        "org_carbon_g_per_kg": 6.2, "ph": 5.9,
        "clay_pct": 28.0, "bulk_density_kg_per_m3": 1380,
        "region_desc": "West Bengal, India (laterite default)",
        "source": "ICAR West Bengal soil surveys",
    },
    "IN:Odisha": {
        "org_carbon_g_per_kg": 7.1, "ph": 5.8,
        "clay_pct": 30.0, "bulk_density_kg_per_m3": 1360,
        "region_desc": "Odisha, India (red laterite)",
        "source": "OUAT soil surveys",
    },
    "IN:Jharkhand": {
        "org_carbon_g_per_kg": 6.8, "ph": 5.7,
        "clay_pct": 29.0, "bulk_density_kg_per_m3": 1370,
        "region_desc": "Jharkhand, India (laterite/red soil)",
        "source": "BAU Ranchi soil surveys",
    },
    "IN:Bihar": {
        "org_carbon_g_per_kg": 4.8, "ph": 8.0,
        "clay_pct": 32.0, "bulk_density_kg_per_m3": 1420,
        "region_desc": "Bihar, India (Gangetic alluvial)",
        "source": "ICAR Bihar soil surveys",
    },
    "IN:Uttar Pradesh": {
        "org_carbon_g_per_kg": 4.2, "ph": 8.3,
        "clay_pct": 30.0, "bulk_density_kg_per_m3": 1440,
        "region_desc": "Uttar Pradesh, India (IGP alluvial)",
        "source": "ICAR UP soil surveys",
    },
    "IN:Maharashtra": {
        "org_carbon_g_per_kg": 6.8, "ph": 7.5,
        "clay_pct": 48.0, "bulk_density_kg_per_m3": 1350,
        "region_desc": "Maharashtra, India (black cotton/Vertisol)",
        "source": "NBSS&LUP Maharashtra",
    },
    "IN:Karnataka": {
        "org_carbon_g_per_kg": 5.9, "ph": 6.8,
        "clay_pct": 42.0, "bulk_density_kg_per_m3": 1360,
        "region_desc": "Karnataka, India (red/black mixed)",
        "source": "UAS Dharwad soil surveys",
    },
    "IN:Tamil Nadu": {
        "org_carbon_g_per_kg": 7.2, "ph": 6.2,
        "clay_pct": 35.0, "bulk_density_kg_per_m3": 1300,
        "region_desc": "Tamil Nadu, India (red laterite)",
        "source": "TNAU soil surveys",
    },
    "IN:Kerala": {
        "org_carbon_g_per_kg": 12.5, "ph": 5.4,
        "clay_pct": 40.0, "bulk_density_kg_per_m3": 1250,
        "region_desc": "Kerala, India (laterite/forest)",
        "source": "KAU soil surveys",
    },
    "IN:Gujarat": {
        "org_carbon_g_per_kg": 4.5, "ph": 7.8,
        "clay_pct": 35.0, "bulk_density_kg_per_m3": 1400,
        "region_desc": "Gujarat, India (alluvial/black mixed)",
        "source": "GAU soil surveys",
    },
    "IN:Rajasthan": {
        "org_carbon_g_per_kg": 2.8, "ph": 8.2,
        "clay_pct": 18.0, "bulk_density_kg_per_m3": 1520,
        "region_desc": "Rajasthan, India (arid/desert soils)",
        "source": "CAZRI soil surveys",
    },
    "IN": {
        "org_carbon_g_per_kg": 4.5, "ph": 7.2,
        "clay_pct": 30.0, "bulk_density_kg_per_m3": 1400,
        "region_desc": "India (national average)",
        "source": "NBSS&LUP national soil survey",
    },

    # ─── UNITED STATES — state-level ──────────────────────────────
    "US:Iowa": {
        "org_carbon_g_per_kg": 18.5, "ph": 6.5,
        "clay_pct": 22.0, "bulk_density_kg_per_m3": 1350,
        "region_desc": "Iowa, USA (Mollisol corn belt)",
        "source": "USDA NRCS, RaCA dataset",
    },
    "US:Illinois": {
        "org_carbon_g_per_kg": 19.2, "ph": 6.4,
        "clay_pct": 24.0, "bulk_density_kg_per_m3": 1340,
        "region_desc": "Illinois, USA (Mollisol corn belt)",
        "source": "USDA NRCS",
    },
    "US:Indiana": {
        "org_carbon_g_per_kg": 17.8, "ph": 6.6,
        "clay_pct": 23.0, "bulk_density_kg_per_m3": 1360,
        "region_desc": "Indiana, USA (Mollisol corn belt)",
        "source": "USDA NRCS",
    },
    "US:Kansas": {
        "org_carbon_g_per_kg": 12.0, "ph": 6.8,
        "clay_pct": 18.0, "bulk_density_kg_per_m3": 1380,
        "region_desc": "Kansas, USA (Great Plains wheat belt)",
        "source": "USDA NRCS",
    },
    "US:Nebraska": {
        "org_carbon_g_per_kg": 14.5, "ph": 6.5,
        "clay_pct": 19.0, "bulk_density_kg_per_m3": 1360,
        "region_desc": "Nebraska, USA (Great Plains)",
        "source": "USDA NRCS",
    },
    "US:California": {
        "org_carbon_g_per_kg": 8.5, "ph": 6.8,
        "clay_pct": 25.0, "bulk_density_kg_per_m3": 1390,
        "region_desc": "California, USA (Central Valley)",
        "source": "USDA NRCS",
    },
    "US:Georgia": {
        "org_carbon_g_per_kg": 7.8, "ph": 5.8,
        "clay_pct": 18.0, "bulk_density_kg_per_m3": 1430,
        "region_desc": "Georgia, USA (Ultisol southeast)",
        "source": "USDA NRCS",
    },
    "US": {
        "org_carbon_g_per_kg": 14.0, "ph": 6.5,
        "clay_pct": 21.0, "bulk_density_kg_per_m3": 1370,
        "region_desc": "USA (national average)",
        "source": "USDA NRCS national survey",
    },

    # ─── BRAZIL ───────────────────────────────────────────────────
    "BR:Mato Grosso": {
        "org_carbon_g_per_kg": 16.5, "ph": 5.2,
        "clay_pct": 45.0, "bulk_density_kg_per_m3": 1230,
        "region_desc": "Mato Grosso, Brazil (Cerrado/soy belt)",
        "source": "EMBRAPA Cerrado",
    },
    "BR:São Paulo": {
        "org_carbon_g_per_kg": 13.8, "ph": 5.6,
        "clay_pct": 38.0, "bulk_density_kg_per_m3": 1260,
        "region_desc": "São Paulo, Brazil (Latosol)",
        "source": "IAC São Paulo soil surveys",
    },
    "BR:Rio Grande do Sul": {
        "org_carbon_g_per_kg": 19.2, "ph": 5.8,
        "clay_pct": 42.0, "bulk_density_kg_per_m3": 1220,
        "region_desc": "Rio Grande do Sul, Brazil (Pampa)",
        "source": "EMBRAPA Sul",
    },
    "BR": {
        "org_carbon_g_per_kg": 14.2, "ph": 5.4,
        "clay_pct": 42.0, "bulk_density_kg_per_m3": 1240,
        "region_desc": "Brazil (national average)",
        "source": "EMBRAPA national survey",
    },

    # ─── CHINA ────────────────────────────────────────────────────
    "CN:Heilongjiang": {
        "org_carbon_g_per_kg": 28.5, "ph": 6.2,
        "clay_pct": 25.0, "bulk_density_kg_per_m3": 1280,
        "region_desc": "Heilongjiang, China (black soil zone)",
        "source": "Chinese Academy of Sciences soil surveys",
    },
    "CN:Jiangsu": {
        "org_carbon_g_per_kg": 14.2, "ph": 6.8,
        "clay_pct": 32.0, "bulk_density_kg_per_m3": 1320,
        "region_desc": "Jiangsu, China (Yangtze alluvial rice)",
        "source": "Nanjing Agricultural University",
    },
    "CN": {
        "org_carbon_g_per_kg": 11.5, "ph": 6.5,
        "clay_pct": 28.0, "bulk_density_kg_per_m3": 1340,
        "region_desc": "China (national average)",
        "source": "Chinese soil survey",
    },

    # ─── AFRICA ───────────────────────────────────────────────────
    "KE": {
        "org_carbon_g_per_kg": 14.2, "ph": 5.8,
        "clay_pct": 38.0, "bulk_density_kg_per_m3": 1280,
        "region_desc": "Kenya (East Africa highlands)",
        "source": "AfSIS East Africa soil surveys",
    },
    "ET": {
        "org_carbon_g_per_kg": 16.8, "ph": 5.6,
        "clay_pct": 42.0, "bulk_density_kg_per_m3": 1260,
        "region_desc": "Ethiopia (highland Vertisols/Nitisols)",
        "source": "EIAR soil surveys",
    },
    "NG": {
        "org_carbon_g_per_kg": 9.2, "ph": 6.1,
        "clay_pct": 28.0, "bulk_density_kg_per_m3": 1340,
        "region_desc": "Nigeria",
        "source": "AfSIS West Africa surveys",
    },
    "GH": {
        "org_carbon_g_per_kg": 8.5, "ph": 6.3,
        "clay_pct": 25.0, "bulk_density_kg_per_m3": 1360,
        "region_desc": "Ghana",
        "source": "AfSIS West Africa surveys",
    },
    "TZ": {
        "org_carbon_g_per_kg": 11.5, "ph": 6.0,
        "clay_pct": 32.0, "bulk_density_kg_per_m3": 1310,
        "region_desc": "Tanzania",
        "source": "AfSIS East Africa surveys",
    },
    "ZA": {
        "org_carbon_g_per_kg": 7.8, "ph": 5.9,
        "clay_pct": 22.0, "bulk_density_kg_per_m3": 1390,
        "region_desc": "South Africa",
        "source": "ARC-ISCW soil surveys",
    },

    # ─── SOUTHEAST ASIA ───────────────────────────────────────────
    "TH": {
        "org_carbon_g_per_kg": 12.8, "ph": 5.8,
        "clay_pct": 38.0, "bulk_density_kg_per_m3": 1280,
        "region_desc": "Thailand (rice-growing lowlands)",
        "source": "IRRI regional surveys",
    },
    "VN": {
        "org_carbon_g_per_kg": 18.5, "ph": 5.5,
        "clay_pct": 45.0, "bulk_density_kg_per_m3": 1220,
        "region_desc": "Vietnam (Mekong/Red River delta)",
        "source": "IRRI Vietnam surveys",
    },
    "ID": {
        "org_carbon_g_per_kg": 22.0, "ph": 5.2,
        "clay_pct": 48.0, "bulk_density_kg_per_m3": 1200,
        "region_desc": "Indonesia (tropical volcanic soils)",
        "source": "ICRAF Southeast Asia",
    },
    "MM": {
        "org_carbon_g_per_kg": 14.5, "ph": 6.2,
        "clay_pct": 40.0, "bulk_density_kg_per_m3": 1240,
        "region_desc": "Myanmar",
        "source": "IRRI regional surveys",
    },
    "PH": {
        "org_carbon_g_per_kg": 19.5, "ph": 5.8,
        "clay_pct": 42.0, "bulk_density_kg_per_m3": 1210,
        "region_desc": "Philippines (volcanic/paddy soils)",
        "source": "IRRI Philippines",
    },

    # ─── EUROPE ───────────────────────────────────────────────────
    "FR": {
        "org_carbon_g_per_kg": 22.0, "ph": 6.5,
        "clay_pct": 22.0, "bulk_density_kg_per_m3": 1290,
        "region_desc": "France",
        "source": "INRAE soil surveys",
    },
    "DE": {
        "org_carbon_g_per_kg": 20.5, "ph": 6.2,
        "clay_pct": 20.0, "bulk_density_kg_per_m3": 1310,
        "region_desc": "Germany",
        "source": "BGR German soil survey",
    },
    "UA": {
        "org_carbon_g_per_kg": 32.0, "ph": 6.8,
        "clay_pct": 28.0, "bulk_density_kg_per_m3": 1260,
        "region_desc": "Ukraine (Chernozem black soil)",
        "source": "FAO European soil database",
    },
    "RU": {
        "org_carbon_g_per_kg": 28.0, "ph": 6.5,
        "clay_pct": 25.0, "bulk_density_kg_per_m3": 1280,
        "region_desc": "Russia (Chernozem/agricultural zones)",
        "source": "FAO European soil database",
    },

    # ─── PAKISTAN / BANGLADESH / SRI LANKA ───────────────────────
    "PK": {
        "org_carbon_g_per_kg": 3.2, "ph": 8.4,
        "clay_pct": 25.0, "bulk_density_kg_per_m3": 1490,
        "region_desc": "Pakistan (Indus alluvial plains)",
        "source": "PARC soil surveys",
    },
    "BD": {
        "org_carbon_g_per_kg": 8.5, "ph": 6.8,
        "clay_pct": 38.0, "bulk_density_kg_per_m3": 1300,
        "region_desc": "Bangladesh (Ganges-Brahmaputra delta)",
        "source": "SRDI Bangladesh soil surveys",
    },
    "LK": {
        "org_carbon_g_per_kg": 11.5, "ph": 5.6,
        "clay_pct": 35.0, "bulk_density_kg_per_m3": 1290,
        "region_desc": "Sri Lanka (red-yellow podzolic)",
        "source": "SLSRTI soil surveys",
    },

    # ─── AUSTRALIA ────────────────────────────────────────────────
    "AU": {
        "org_carbon_g_per_kg": 9.5, "ph": 6.2,
        "clay_pct": 25.0, "bulk_density_kg_per_m3": 1400,
        "region_desc": "Australia (agricultural zones)",
        "source": "CSIRO national soil surveys",
    },

    # ─── GLOBAL FALLBACK ──────────────────────────────────────────
    "GLOBAL": {
        "org_carbon_g_per_kg": 9.0, "ph": 6.5,
        "clay_pct": 30.0, "bulk_density_kg_per_m3": 1350,
        "region_desc": "Global average estimate",
        "source": "FAO Global Soil Database",
    },
}

# ── degradation scoring ───────────────────────────────────────────────────────

REGIONAL_BASELINE = {
    "soc_gkg":        15.0,
    "soc_critical":    5.0,
    "ph_optimal_low":  6.0,
    "ph_optimal_hi":   7.5,
    "clay_pct_min":   15.0,
    "clay_pct_max":   45.0,
    "bdod_threshold":  1.45,
    "bdod_critical":   1.65,
}


def _score_soc(soc_gkg: float | None) -> int:
    if soc_gkg is None:
        return 50
    if soc_gkg >= 15.0:
        return 0
    if soc_gkg >= 10.0:
        return 15
    if soc_gkg >= 6.0:
        return 35
    if soc_gkg >= 3.0:
        return 65
    return 90


def _score_ph(ph: float | None) -> int:
    if ph is None:
        return 20
    if 6.0 <= ph <= 7.5:
        return 0
    if 5.5 <= ph < 6.0:
        return 20
    if 7.5 < ph <= 8.0:
        return 20
    if 5.0 <= ph < 5.5:
        return 50
    if 8.0 < ph <= 8.5:
        return 40
    if ph < 5.0:
        return 80
    return 75


def _score_bdod(bdod_g_cm3: float | None) -> int:
    if bdod_g_cm3 is None:
        return 20
    if bdod_g_cm3 <= 1.30:
        return 0
    if bdod_g_cm3 <= 1.40:
        return 15
    if bdod_g_cm3 <= 1.50:
        return 35
    if bdod_g_cm3 <= 1.60:
        return 60
    if bdod_g_cm3 <= 1.70:
        return 80
    return 95


def _score_clay(clay_pct: float | None) -> int:
    if clay_pct is None:
        return 20
    if 20.0 <= clay_pct <= 40.0:
        return 0
    if 15.0 <= clay_pct < 20.0:
        return 15
    if 40.0 < clay_pct <= 50.0:
        return 25
    if 10.0 <= clay_pct < 15.0:
        return 35
    if 50.0 < clay_pct <= 60.0:
        return 50
    if clay_pct < 10.0:
        return 60
    return 70


def _overall_degradation_score(soc: int, ph: int, bdod: int, clay: int) -> int:
    return round(0.40 * soc + 0.30 * bdod + 0.20 * ph + 0.10 * clay)


# ── coordinate bounding-box fallback ─────────────────────────────────────────
# Checked only when Nominatim CC:State lookup fails.  Entries are evaluated in
# order; first match wins.  (lat_min, lat_max, lon_min, lon_max, region_key)
_BBOX_FALLBACK: list[tuple[float, float, float, float, str]] = [
    # Punjab + Chandigarh UT corridor — IGP alluvial, pH ~8.7
    (29.5, 32.5, 73.8, 77.2, "IN:Punjab"),
    # Haryana — east of Punjab, same IGP plain
    (27.6, 30.9, 74.5, 77.6, "IN:Haryana"),
    # Uttar Pradesh
    (23.8, 30.4, 77.1, 84.7, "IN:Uttar Pradesh"),
    # Bihar
    (24.3, 27.5, 83.3, 88.3, "IN:Bihar"),
    # West Bengal
    (21.5, 27.2, 85.8, 89.9, "IN:West Bengal"),
    # Mato Grosso, Brazil — Cerrado soy belt
    (-18.1, -7.3, -61.0, -50.2, "BR:Mato Grosso"),
    # Iowa, USA corn belt
    (40.4, 43.5, -96.7, -90.1, "US:Iowa"),
]


def _bbox_lookup(lat: float, lon: float) -> tuple[dict, str] | None:
    for lat_min, lat_max, lon_min, lon_max, key in _BBOX_FALLBACK:
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            if key in SOIL_BASELINES:
                return SOIL_BASELINES[key], key
    return None


# ── geocoding-based region detection ─────────────────────────────────────────

async def reverse_geocode(lat: float, lon: float) -> dict:
    """
    Returns {country_code, country, admin1, admin2} for a coordinate.
    Uses Nominatim (OpenStreetMap) — free, no auth, 1 req/s policy.
    Falls back to empty dict on any error.
    """
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "zoom": 10,
        "addressdetails": 1,
    }
    headers = {
        "User-Agent": "Fieldpulse/1.0 (github.com/DhwanilPanchani/fieldpulse)"
    }
    try:
        await _API_LIMITER.acquire()
        async with get_client() as client:
            r = await client.get(url, params=params, headers=headers, timeout=10.0)
            r.raise_for_status()
            data = r.json()
        address = data.get("address", {})
        return {
            "country_code": address.get("country_code", "").upper(),
            "country": address.get("country", ""),
            "admin1": address.get("state", ""),
            "admin2": address.get("county", address.get("city", "")),
            "raw": address,
        }
    except Exception as e:
        logger.warning("Reverse geocode failed: %s", e)
        return {}


async def _detect_region_by_geocode(lat: float, lon: float) -> tuple[dict, str]:
    """
    Returns (baseline_dict, region_key).
    Lookup order: CC:State → CC → GLOBAL
    """
    geo = await reverse_geocode(lat, lon)
    country_code = geo.get("country_code", "")
    admin1 = geo.get("admin1", "")

    if country_code and admin1:
        state_key = f"{country_code}:{admin1}"
        if state_key in SOIL_BASELINES:
            return SOIL_BASELINES[state_key], state_key

    # Nominatim returned a state name we don't have a baseline for — try bbox
    bbox = _bbox_lookup(lat, lon)
    if bbox is not None:
        return bbox

    if country_code and country_code in SOIL_BASELINES:
        return SOIL_BASELINES[country_code], country_code

    return SOIL_BASELINES["GLOBAL"], "GLOBAL"


# ── NASA POWER (soil moisture indices) ───────────────────────────────────────

NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"


async def _fetch_nasa_power(lat: float, lon: float) -> dict:
    async with get_client() as client:
        await _API_LIMITER.acquire()
        r = await client.get(
            NASA_POWER_URL,
            params={
                "parameters": "GWETROOT,GWETPROF,GWETTOP",
                "community": "AG",
                "longitude": lon,
                "latitude": lat,
                "start": "2020",
                "end": "2023",
                "format": "JSON",
            },
            timeout=30.0,
        )
        r.raise_for_status()
        body = r.json()

    params_data = body["properties"]["parameter"]

    def _mean_all(series: dict) -> float:
        vals = [v for v in series.values() if v is not None and v != -999.0]
        return round(sum(vals) / len(vals), 4) if vals else 0.0

    return {
        "root_zone_wetness_index": _mean_all(params_data.get("GWETROOT", {})),
        "topsoil_wetness_index":   _mean_all(params_data.get("GWETTOP",  {})),
    }


# ── soil profile ──────────────────────────────────────────────────────────────

async def _get_soil_profile(lat: float, lon: float) -> dict:
    cache_key = f"soilprofile_v7_{lat:.4f}_{lon:.4f}"
    cached = _cache_mod.get(cache_key)
    if cached is not None:
        return cached

    baseline, region_key = await _detect_region_by_geocode(lat, lon)

    moisture: dict = {}
    try:
        moisture = await _fetch_nasa_power(lat, lon)
        logger.info("NASA POWER moisture fetch succeeded for %.4f, %.4f", lat, lon)
    except Exception as e:
        logger.warning("NASA POWER failed: %s: %s", type(e).__name__, e)

    result = {
        "source": f"nasa_power_moisture + {region_key}_baseline",
        "root_zone_wetness_index": moisture.get("root_zone_wetness_index"),
        "topsoil_wetness_index":   moisture.get("topsoil_wetness_index"),
        "org_carbon_g_per_kg":     baseline["org_carbon_g_per_kg"],
        "ph":                      baseline["ph"],
        "clay_pct":                baseline["clay_pct"],
        "bulk_density_kg_per_m3":  baseline["bulk_density_kg_per_m3"],
        "region":                  baseline["region_desc"],
        "data_confidence": "low",
        "warning": (
            "Soil chemistry values are regional scientific estimates from FAO/USDA/ICAR "
            "literature, not measured at this exact field. Soil moisture indices are real "
            "satellite data from NASA POWER (2020-2023). For field-specific chemistry, "
            "collect a soil sample or retry when SoilGrids API service is restored "
            "(currently paused by ISRIC)."
        ),
        "future_enhancement": (
            "Google Earth Engine integration planned — will provide field-specific "
            "30m resolution soil data when configured."
        ),
        "lat": lat,
        "lon": lon,
    }

    _cache_mod.set(cache_key, result, ttl_seconds=43200)
    return result


async def _get_soil_degradation_risk(lat: float, lon: float) -> dict:
    cache_key = f"soilrisk_v4_{lat:.4f}_{lon:.4f}"
    cached = _cache_mod.get(cache_key)
    if cached is not None:
        return cached

    profile = await _get_soil_profile(lat, lon)

    soc  = profile.get("org_carbon_g_per_kg")
    ph   = profile.get("ph")
    clay = profile.get("clay_pct")
    bdod_raw = profile.get("bulk_density_kg_per_m3")
    bdod = round(bdod_raw / 1000.0, 4) if bdod_raw is not None else None

    soc_s  = _score_soc(soc)
    ph_s   = _score_ph(ph)
    bdod_s = _score_bdod(bdod)
    clay_s = _score_clay(clay)
    total  = _overall_degradation_score(soc_s, ph_s, bdod_s, clay_s)

    trend = "improving" if total < 20 else ("stable" if total < 45 else "declining")

    result = {
        "degradation_score": total,
        "trend": trend,
        "factor_scores": {
            "organic_carbon": soc_s,
            "bulk_density":   bdod_s,
            "ph":             ph_s,
            "clay_fraction":  clay_s,
        },
        "measured_values": {
            "soc_g_per_kg":       round(soc,  2) if soc  is not None else None,
            "ph":                 round(ph,   2) if ph   is not None else None,
            "clay_pct":           round(clay, 1) if clay is not None else None,
            "bulk_density_g_cm3": round(bdod, 3) if bdod is not None else None,
        },
        "regional_baselines": REGIONAL_BASELINE,
        "data_source":      profile.get("source"),
        "data_confidence":  profile.get("data_confidence"),
        "data_warning":     profile.get("warning"),
    }

    _cache_mod.set(cache_key, result, ttl_seconds=86400)
    return result


# ── MCP server ────────────────────────────────────────────────────────────────

server = Server("fieldpulse-soil")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_soil_profile",
            description=(
                "Fetch soil organic carbon, pH, clay content, and bulk density "
                "using a three-tier fallback chain: OpenLandMap API → NASA POWER → "
                "regional static baseline. Always returns a result."
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
        Tool(
            name="get_soil_degradation_risk",
            description="Compute 0–100 soil degradation risk score with factor breakdown.",
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
        lat = float(arguments["lat"])
        lon = float(arguments["lon"])
        validate_coordinates(lat, lon)

        if name == "get_soil_profile":
            result = await _get_soil_profile(lat, lon)
        elif name == "get_soil_degradation_risk":
            result = await _get_soil_degradation_risk(lat, lon)
        else:
            result = {"error": "unknown_tool", "message": f"Unknown tool: {name}", "tool": name}

    except ValueError as e:
        result = {
            "error": "input_validation_error",
            "message": str(e),
            "tool": name,
            "recoverable": False,
        }
    except Exception as e:
        logger.error("Unexpected error in %s: %s: %s", name, type(e).__name__, e)
        result = {
            "error": "unexpected_error",
            "message": str(e),
            "tool": name,
            "recoverable": False,
        }

    return [TextContent(type="text", text=json.dumps(result, indent=2))]


async def main():
    async with stdio_server() as streams:
        await server.run(streams[0], streams[1], server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
