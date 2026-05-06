# Fieldpulse

**Real-time vitals for your land.**

[![Python 3.9+](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](scripts/setup.py)

Fieldpulse is a multi-agent agricultural intelligence system that detects soil degradation and crop failure risk from satellite imagery, soil data, and weather signals — all using free, public APIs that require no hardware or paid subscriptions. It was built for the 570 million smallholder farmers, agronomists, and food-security researchers who need early-warning capability but can't pay thousands of dollars for precision-agriculture platforms. All reasoning runs on your own Claude plan. No data leaves your machine except outbound requests to three public APIs.

---

## Two Ways to Use Fieldpulse

```
Are you a developer or researcher?
                │
       ┌────────┴────────┐
      YES                NO
       │                 │
       ▼                 ▼
Claude Code Plugin    Web Dashboard
  (full pipeline)     (weather-only,
                       browser-based)
```

**Developers / Researchers — Claude Code Plugin**

# Fieldpulse — Claude Code Plugin

Fieldpulse is an agricultural intelligence plugin for Claude Code that combines satellite imagery, soil analysis, and weather forecasting to generate crop risk insights and actionable recommendations.

---

# Quick Start

## Requirements

Before installing, make sure you have:

- Claude Code ≥ 2.1.32
- Python ≥ 3.9
- macOS, Linux, or Windows
- Internet connection
- No API keys required

---

# Installation

## Step 1 — Clone Repository & Run Setup

```bash
git clone https://github.com/DhwanilPanchani/fieldpulse
cd fieldpulse
python3 scripts/setup.py
```

The setup script will:

- Create a virtual environment at:

```bash
~/.fieldpulse/venv
```

- Print the MCP registration commands required for your machine

Copy and run all generated commands.

Example:

```bash
claude mcp add fieldpulse-satellite -- ~/.fieldpulse/venv/bin/python /your/path/fieldpulse/mcp_servers/satellite_mcp.py

claude mcp add fieldpulse-soil -- ~/.fieldpulse/venv/bin/python /your/path/fieldpulse/mcp_servers/soil_mcp.py

claude mcp add fieldpulse-weather -- ~/.fieldpulse/venv/bin/python /your/path/fieldpulse/mcp_servers/weather_mcp.py
```

---

## Verify MCP Connections

```bash
claude mcp list
```

Expected output:

```bash
fieldpulse-satellite: ... ✓ Connected
fieldpulse-soil:      ... ✓ Connected
fieldpulse-weather:   ... ✓ Connected
```

---

## Step 2 — Configure Git for HTTPS

This is a one-time setup required for plugin installation.

### Recommended (Global)

```bash
git config --global url."https://github.com/".insteadOf "git@github.com:"
```

### Scoped Alternative (Only for Fieldpulse)

If you already use SSH for your own GitHub repositories:

```bash
git config --global url."https://github.com/DhwanilPanchani/".insteadOf "git@github.com:DhwanilPanchani/"
```

---

## Step 3 — Install the Plugin

```bash
claude plugin marketplace add https://github.com/DhwanilPanchani/fieldpulse.git

claude plugin install fieldpulse
```

---

# First Run

Launch Claude Code:

```bash
claude
```

Then run:

```bash
/fieldpulse:analyze "Punjab, India" --crop wheat --radius 10km
```

---

# Example Output

```text
--- FIELDPULSE RESULT ---

Location : Punjab, India
Crop     : wheat
Radius   : 10km
Date     : 2026-05-05

RISK LEVEL: HIGH 🟠

Outlook:
30 days : HIGH 🟠
60 days : CRITICAL 🔴
90 days : HIGH 🟠

Key Signals:
Vegetation :
NDVI mean 0.56 — within season range,
+8% vs regional baseline.

Soil :
pH 8.7 (alkaline) — above optimal for wheat;
may limit iron and zinc availability.

Weather :
Water deficit tracking;
12 heat stress days above 32°C forecast
during grain-fill window.

Top Action:
- Monitor irrigation schedule against forecast ET₀ deficit
- Apply micronutrient foliar spray if yellowing appears
  (pH-induced deficiency)

Report saved:
./fieldpulse_reports/punjab_india_20260505_143211.md
```

---

# Reports

Generated reports are automatically saved as Markdown files inside:

```bash
./fieldpulse_reports/
```

Each report includes:

- Crop risk assessment
- Vegetation analysis
- Soil condition analysis
- Weather stress forecasting
- Actionable recommendations

---

# Architecture

Fieldpulse uses three MCP servers:

| MCP Server | Purpose |
|---|---|
| `fieldpulse-satellite` | Satellite vegetation analysis |
| `fieldpulse-soil` | Soil chemistry & fertility analysis |
| `fieldpulse-weather` | Weather forecasting & climate stress analysis |

---

# Troubleshooting

## MCP Server Not Connected

Verify all MCP servers are registered:

```bash
claude mcp list
```

If missing, rerun the setup script:

```bash
python3 scripts/setup.py
```

---

## Plugin Install Fails

Make sure GitHub URLs are configured for HTTPS:

```bash
git config --global --get-regexp url
```

---

## Python Version Issues

Check your Python version:

```bash
python3 --version
```

Minimum supported version:

```text
Python 3.9+
```

---

## Quick Start — Web Dashboard

1. Visit [https://fieldpulse.vercel.app](https://fieldpulse.vercel.app)
2. Type a location (e.g. "Bankura, West Bengal") and select your crop
3. Click **Analyze**

[Dashboard screenshot]

> **Note:** The web dashboard uses Open-Meteo weather data only. Satellite NDVI and soil data require the Claude Code plugin due to CORS restrictions on MODIS ORNL and NASA POWER APIs from browser environments.

---

## How It Works

```
User types location + crop
           │
           ▼
  Orchestrator Agent  ── geocodes location, builds bounding box
  (Claude, your tokens)
           │
    ┌──────┼──────┐  parallel async
    ▼      ▼      ▼
 Weather  Soil  Satellite    ← local Python MCP servers
  Agent  Agent   Agent         (stdio, run on your machine)
    │      │       │
    └──────┼───────┘
           ▼
     Fusion Agent   ── applies crop × risk weight matrix
           │
           ▼
      Risk Agent    ── composite score + 30/60/90-day trajectory
                        + ranked interventions
           │
           ▼
Terminal summary + ./fieldpulse_reports/[location]_[date].md
```

**Agent responsibilities:**

- **Orchestrator** — Parses command, geocodes location to lat/lon, builds bounding box (`dlat = radius_km / 111`), spawns the three data agents in parallel, then calls fusion and risk sequentially.
- **Weather Agent** — Calls Open-Meteo archive + forecast. Computes SPI-3 drought index, heat stress days per crop threshold, and ET₀ water deficit.
- **Soil Agent** — Calls NASA POWER for real soil moisture indices. Maps region via Nominatim reverse geocoding to validated FAO/USDA/ICAR baselines for soil chemistry.
- **Satellite Agent** — Calls MODIS ORNL MOD13Q1 for 16-day NDVI composites at 250 m resolution. Skips fill values (-28672) for cloud/missing data. Compares result to regional seasonal baseline.
- **Fusion Agent** — Loads the crop-type weight matrix, applies phenological stage modifiers, produces a single weighted risk score with per-factor breakdown.
- **Risk Agent** — Converts the fusion score to a risk band, generates 30/60/90-day trajectory using forecast data and trend extrapolation, and ranks the top 3 drivers with plain-language interventions.

All reasoning runs on your Claude plan. The plugin makes no calls to Anthropic on your behalf — Claude Code does.

---

## Data Sources

| Signal | Source | Auth | Status |
|--------|--------|------|--------|
| Weather (history) | [Open-Meteo Historical](https://archive-api.open-meteo.com) | None | ✅ Live |
| Weather (forecast) | [Open-Meteo Forecast](https://api.open-meteo.com) | None | ✅ Live |
| Satellite NDVI | [MODIS ORNL MOD13Q1](https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset) | None | ✅ Live |
| Soil moisture | [NASA POWER](https://power.larc.nasa.gov/api/temporal/monthly/point) | None | ✅ Live |
| Soil chemistry | FAO/USDA/ICAR regional baselines | N/A | ✅ Validated |
| ISRIC SoilGrids | `rest.isric.org` | None | ⏸ Paused by ISRIC |

**Satellite detail:** MODIS ORNL MOD13Q1 returns real 16-day NDVI composites at 250 m resolution. Maximum 10 tiles (160 days) per request — the plugin issues multiple requests for 12-month analysis. Fill value -28672 (cloud or missing data) is detected and skipped. Real values for healthy wheat in Punjab during season: NDVI 0.41–0.65.

**Soil chemistry note:** ISRIC SoilGrids REST API is currently paused by ISRIC with no announced restoration timeline. Soil chemistry (pH, organic carbon, clay fraction, bulk density) is therefore derived from validated regional scientific baselines sourced from FAO, USDA, and ICAR literature. Region detection uses Nominatim reverse geocoding (OpenStreetMap) to identify country and admin1 (state/province), then maps to the closest available baseline. This is an estimate, not a field-specific measurement — see [Honest Limitations](#honest-limitations).

---

## Supported Crops and Regions

**Crops with heat stress thresholds:**

| Crop | Heat Threshold |
|------|---------------|
| wheat | 32 °C |
| rice | 35 °C |
| maize | 34 °C |
| soybean | 34 °C |
| cotton | 38 °C |
| sugarcane | 38 °C |
| generic | 33 °C |

**Soil baseline coverage (40+ regions):**

- **India (15 states):** Punjab, Haryana, UP, Rajasthan, MP, Maharashtra, Karnataka, AP, Telangana, Tamil Nadu, West Bengal, Bihar, Gujarat, Odisha, Jharkhand
- **USA (7 states):** Iowa, Illinois, Kansas, Nebraska, California, Texas, North Dakota
- **Brazil (3 regions):** Mato Grosso, São Paulo, Paraná
- **China:** Hebei, Hunan
- **20+ countries at national level** including Kenya, Ethiopia, Nigeria, Indonesia, Bangladesh, Pakistan, Ukraine, France, Argentina, Mexico

Baseline accuracy is highest for South Asia and the US Corn Belt, where the most peer-reviewed field measurement data is available. Sub-Saharan Africa and Southeast Asia use broader national averages and carry higher uncertainty.

---

## Commands (Claude Code Plugin)

| Command | Description | Example |
|---------|-------------|---------|
| `/fieldpulse:analyze` | Full risk analysis — weather + soil + satellite | `/fieldpulse:analyze "Iowa, USA" --crop maize` |
| `/fieldpulse:monitor` | Batch analysis with delta reports across multiple locations | `/fieldpulse:monitor locations.txt --crop wheat` |
| `/fieldpulse:report` | Re-render a previous analysis or convert to HTML | `/fieldpulse:report fieldpulse_reports/iowa_20260505.md` |
| `/fieldpulse:explain` | Plain-English explanation of the last result, no jargon | `/fieldpulse:explain` |

All commands accept `--radius` (default 10 km) and `--crop` (default: generic).

---

## Risk Scoring

The composite risk score (0–100) uses the following formula, derived from peer-reviewed agronomic literature:

```
heat_score    = min(100, heat_stress_days × 8 + forecast_heat_days × 12)
drought_score = min(100, water_deficit_mm / 3 + forecast_deficit_mm / 2)
veg_penalty   = 15 if ndvi_mean < 0.2 (poor canopy cover)

overall = (heat_score × 0.4) + (drought_score × 0.5) + veg_penalty
```

**Risk bands:**

| Score | Band |
|-------|------|
| 0–25 | LOW |
| 26–50 | MEDIUM |
| 51–75 | HIGH |
| 76–100 | CRITICAL |

Heat and drought weights reflect that water deficit is the primary yield driver in semi-arid regions (50%) while heat is the fastest-acting stressor, especially at anthesis (40%). NDVI enters as a penalty term because it is a lagging integrating signal, not a leading indicator.

**Literature basis:** Lobell et al. (2012) *Science*; Prasad et al. (2008) *J. Geophys. Res.*; McKee et al. (1993) AMS; FAO/ITPS (2015) *Status of the World's Soil Resources*; Brady & Weil (2016) *The Nature and Properties of Soils*.

---

## Security

All of the following are implemented and verified in the current codebase (57/57 tests passing):

- **Path traversal protection** — cache key resolution verifies the resolved path falls within `~/.fieldpulse/cache/` before any read or write
- **Input validation before I/O** — coordinates with NaN, Inf, or out-of-range values (lat outside ±90, lon outside ±180) are rejected before any network call
- **Exact dependency pinning** — `requirements.txt` uses exact version pins; use `pip-compile --generate-hashes` for hash-verified installs
- **Isolated virtual environment** — setup installs into `~/.fieldpulse/venv`, not the global Python environment
- **Cache file permissions** — cache files written with `0o600` permissions via atomic write (temp file + rename) to prevent partial reads
- **Rate limiting per API service** — prevents IP bans during batch analysis runs
- **Structured error returns** — all MCP server tool handlers return structured JSON on error; the server never crashes silently

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for the full audit trail.

---

## Honest Limitations

This section exists because you deserve to know what the system actually does versus what it estimates.

**Soil chemistry is regional, not field-specific.** ISRIC SoilGrids — the primary source for field-level soil measurements — is currently paused by ISRIC with no restoration timeline. Until an alternative (e.g. Google Earth Engine SoilGrids layers, OpenSoils) is integrated, soil chemistry values are regional scientific baselines. They reflect typical values for your soil type and region, not measurements from your specific field. Treat soil scores as background conditions, not ground truth.

**NDVI baseline is regional, not your field's history.** The anomaly percentage compares your current NDVI to a literature-derived seasonal average for the region and crop type — not to satellite images of your specific field from previous years. A field-specific historical baseline would require storing per-field archives, which is planned but not yet implemented.

**Satellite stress index uses approximate values.** The `get_vegetation_stress_index` tool (NDWI, EVI) uses MODIS GIBS approximate rendering. The main `get_ndvi_timeseries` tool uses real MODIS ORNL MOD13Q1 data. Fixing the stress index tool to use ORNL data consistently is a known gap and a priority for the next release.

**Web dashboard is weather-only.** MODIS ORNL and NASA POWER APIs do not support CORS from browser environments. The Vercel web dashboard therefore shows weather-based risk only. Full three-signal analysis requires the Claude Code plugin.

**90-day trajectory is extrapolated.** Open-Meteo free tier provides up to 16 days of deterministic forecast. The 60- and 90-day outlooks are extrapolated from the current trend direction and the 30-day forecast tail, not from a medium-range seasonal model.

---

## Test Results

These are verified results from real API calls made during development and testing:

**Punjab, India — wheat (lat=30.7, lon=76.8)**
- NDVI mean: 0.56 (healthy range for wheat in season)
- Weather data completeness: 100%
- Soil pH baseline: 8.7 (alkaline, as expected for Indo-Gangetic alluvium)
- NASA POWER soil moisture retrieved successfully

**Iowa, USA — maize (lat=41.88, lon=-93.10)**
- NDVI tracking active
- Soil baseline: OC 18.5 g/kg, pH 6.5 (Mollisol — accurate for Iowa)
- Weather risk: HIGH (heat and drought score elevated in test period)

**Bankura, West Bengal — rice**
- NDVI: +23.6% above regional baseline (strong monsoon canopy)
- Soil pH baseline: 5.9 (laterite — accurate for Bankura Lateritic Zone)

**East Africa (lat=1.3, lon=36.8) — generic**
- NASA POWER soil moisture index: 0.37 (dry)
- Soil pH baseline: 6.0 (East African highland)
- Full pipeline completed with no errors

All 57 unit and integration tests pass. Run `pytest tests/` after setup to verify on your machine.

---

## Requirements

- Claude Code ≥ 2.1.32
- Python ≥ 3.9
- macOS, Linux, or Windows
- Internet connection
- No API keys required

---

## Contributing

Issues and pull requests welcome at [github.com/DhwanilPanchani/fieldpulse](https://github.com/DhwanilPanchani/fieldpulse).

**Most-wanted contributions:**

- **Google Earth Engine integration** — would replace regional soil baselines with field-specific EE SoilGrids layers and enable per-field NDVI historical archives
- **Satellite stress index fix** — replace MODIS GIBS tile rendering in `get_vegetation_stress_index` with the same MODIS ORNL REST approach used in `get_ndvi_timeseries`
- **Additional regional soil baselines** — particularly Sub-Saharan Africa (country and admin-level), Central Asia, and Southeast Asia island regions
- **Phenology calendars for Sub-Saharan Africa** — planting/harvest date tables to enable phenological stage modifiers for the region
- **SMS/WhatsApp delivery layer** — farmers without internet access need alert delivery via Twilio or Africa's Talking; the risk score output is already structured for this

If you add a soil baseline, source it from peer-reviewed literature or a recognized national soil survey, and include the citation in the baseline file.

---

## License

MIT — see [LICENSE](LICENSE)
