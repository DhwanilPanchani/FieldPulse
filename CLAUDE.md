# FieldPulse — Agricultural Intelligence Plugin

## What This Plugin Does

FieldPulse transforms Claude into a multi-agent agricultural intelligence system capable of detecting soil degradation and crop failure risk from satellite, soil, and weather signals — all using free, public APIs that require no hardware or paid subscriptions. It was built to give smallholder farmers, agronomists, and food-security researchers the same early-warning capability that precision-agriculture platforms charge thousands of dollars to provide.

The system fetches 12 months of Sentinel-2 NDVI satellite imagery, ISRIC SoilGrids soil chemistry profiles, and Open-Meteo climate history/forecast, fuses them using a crop-type-aware weighting model, and produces a risk score with a 30/60/90-day trajectory. All reasoning runs on the user's own Claude tokens — no data leaves the local machine except for the outbound API calls to the three public data sources.

---

## Agents

### `agents/orchestrator.md` — Master Coordinator
Parses the user command, geocodes the location to lat/lon, builds the bounding box, spawns the three data-fetch agents in parallel via the Task tool, waits for all three to complete, then calls the fusion and risk agents sequentially. Produces the final Markdown report.

### `agents/satellite_agent.md` — Vegetation Signal
Uses the `fieldpulse-satellite` MCP server to fetch 12 months of Sentinel-2 NDVI time series and compute vegetation stress indices (NDWI, EVI). Identifies anomalies against the same-month prior-year baseline. Reports NDVI trend direction (improving / stable / declining) and flags any anomaly > 15% below baseline as a concern.

### `agents/soil_agent.md` — Soil Chemistry Signal
Uses the `fieldpulse-soil` MCP server to query ISRIC SoilGrids for organic carbon, pH, clay fraction, and bulk density at 0–30 cm depth. Compares values to crop-type optimal ranges. Computes a degradation score (0–100) and trend direction. Returns confidence intervals from the SoilGrids uncertainty bands.

### `agents/weather_agent.md` — Climate Signal
Uses the `fieldpulse-weather` MCP server to fetch 12 months of precipitation and temperature history plus a 30-day forecast from Open-Meteo. Computes SPI-3 drought index, counts heat stress days (> 35 °C for wheat), and projects short-term evapotranspiration deficit.

### `agents/fusion_agent.md` — Signal Integration
Loads `skills/risk-scoring/SKILL.md` for the crop-type weight matrix. Combines NDVI, soil, and weather factor scores using crop-adjusted weights. Applies phenological stage modifiers based on the current calendar date and crop type. Produces a single weighted risk score (0–100) with per-factor breakdown.

### `agents/risk_agent.md` — Risk Narrative
Takes the fusion score and per-factor breakdown and produces: (1) current risk band (LOW / MODERATE / HIGH / SEVERE / CRITICAL), (2) 30 / 60 / 90-day trajectory using forecast data and soil trend extrapolation, (3) ranked list of top 3 risk drivers with plain-language explanation, (4) recommended interventions sorted by urgency.

---

## Skills

### `skills/ndvi-analysis/SKILL.md`
How to interpret raw NDVI values for specific crop types, how to compute anomaly percentage relative to seasonal baseline, and how to weight NDVI in different phenological stages. Load this before interpreting any satellite data.

### `skills/soil-interpretation/SKILL.md`
Reference tables for optimal soil chemistry by crop type (organic carbon, pH, clay, bulk density). How to read SoilGrids confidence intervals and flag low-confidence readings. Load this before interpreting any soil data.

### `skills/drought-index/SKILL.md`
How to compute a simplified SPI-3 (Standardized Precipitation Index, 3-month) from Open-Meteo monthly precipitation data. Threshold table for drought severity. How to cross-reference with evapotranspiration to compute water deficit. Load this when computing drought risk.

### `skills/risk-scoring/SKILL.md`
The master risk scoring rubric: factor weights by crop type and region, phenological stage modifiers, scoring tables for each factor, final band thresholds, and the fusion algebra. This is the most critical skill — always load it during fusion.

---

## MCP Servers

### `fieldpulse-satellite` (mcp_servers/satellite_mcp.py)
**Tools:**
- `get_ndvi_timeseries(lat, lon, radius_km, months)` — Returns monthly NDVI mean + anomaly % using Sentinel-2 via Microsoft Planetary Computer STAC. Falls back to NASA MODIS GIBS on error.
- `get_vegetation_stress_index(lat, lon)` — Returns NDWI (water stress), EVI (enhanced vegetation), and a stress level enum.

### `fieldpulse-soil` (mcp_servers/soil_mcp.py)
**Tools:**
- `get_soil_profile(lat, lon)` — Queries ISRIC SoilGrids REST API for OC, pH, clay, bulk density at 0–5, 5–15, 15–30 cm depths.
- `get_soil_degradation_risk(lat, lon)` — Computes degradation score from SoilGrids values vs regional baselines.

### `fieldpulse-weather` (mcp_servers/weather_mcp.py)
**Tools:**
- `get_climate_history(lat, lon, months)` — Calls Open-Meteo archive API. Returns monthly precip, mean temp, heat stress days, SPI-3 drought index.
- `get_forecast(lat, lon, days)` — Calls Open-Meteo forecast API. Returns daily precip, max temp, evapotranspiration.

---

## Analysis Workflow

1. **Parse** — Extract location, crop type, and radius from user command. Geocode to lat/lon if needed.
2. **Bound** — Compute bounding box: `dlat = radius_km / 111`, `dlon = radius_km / (111 × cos(lat))`.
3. **Fetch (parallel)** — Spawn satellite, soil, and weather agents simultaneously via the Task tool.
4. **Validate** — Check each agent result for completeness. Apply graceful degradation rules (see below).
5. **Load skill** — Read `skills/risk-scoring/SKILL.md` to get weight matrix for the crop type and region.
6. **Fuse** — Call fusion agent with all three data payloads + skill weights.
7. **Score** — Call risk agent to produce current band + trajectory.
8. **Report** — Synthesize Markdown report following the output format below.

---

## Graceful Degradation Rules

- If satellite data is unavailable or cloud cover > 80% for > 3 consecutive months, omit NDVI factor and redistribute its weight: +10% to weather, +5% to soil. Note the gap in the report.
- If SoilGrids confidence interval is wide (Q95 − Q05 > 2× mean), flag the value as low-confidence but still include it with a warning.
- If Open-Meteo archive returns < 6 months of data, disable the 90-day trajectory and note it.
- Never ask the user for an API key. All data sources are free and require no authentication except Copernicus (optional). If Copernicus STAC fails, fall back to Microsoft Planetary Computer automatically. If MPC also fails, fall back to NASA MODIS GIBS approximate NDVI.
- If any single agent fully fails, continue with remaining agents and clearly state which signal is missing in the report.

---

## Output Format (Always Markdown)

Every analysis must produce a report with this structure:

```
# FieldPulse Report — [Location] ([Date])

## Risk Summary
| Factor          | Score | Level    |
|-----------------|-------|----------|
| Vegetation (NDVI)| xx/100 | HIGH    |
| Water Stress    | xx/100 | MODERATE |
| Heat Stress     | xx/100 | LOW      |
| Soil Health     | xx/100 | HIGH     |
| **COMPOSITE**   | **xx/100** | **HIGH** |

## Risk Trajectory
- Current: HIGH
- 30-day outlook: SEVERE
- 60-day outlook: HIGH
- 90-day outlook: MODERATE

## Top Risk Drivers
1. [Driver 1 — plain-language explanation]
2. [Driver 2]
3. [Driver 3]

## Data Sources
- Satellite: [source used, date range, cloud cover %]
- Soil: [SoilGrids version, confidence level]
- Weather: [date range, data completeness %]

## Recommended Actions
[Prioritized intervention list with urgency tags]

## Raw Data Appendix
[Collapsible tables with all fetched values]
```

Reports are always saved to `fieldpulse_report_[location]_[date].md` in the current directory.
