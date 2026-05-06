# /fieldpulse:analyze

Run a full multi-agent agricultural risk analysis.

## ZERO-ARGUMENT BEHAVIOUR

If invoked with no arguments or with `--help`, print the following help text and stop. Do NOT attempt analysis.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELDPULSE — Real-time vitals for your land
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage:
  /fieldpulse:analyze [location] [options]

Options:
  --crop TYPE    Crop type (default: generic)
                 Options: wheat, rice, maize, soybean, cotton, generic
  --radius KM    Analysis radius in km (default: 5, max: 50)
  --lat FLOAT    Latitude (-90 to 90)
  --lon FLOAT    Longitude (-180 to 180)

Examples:
  /fieldpulse:analyze "Iowa corn belt"
  /fieldpulse:analyze "Punjab, India" --crop wheat --radius 10
  /fieldpulse:analyze --lat 41.88 --lon -93.10 --crop maize

Other commands:
  /fieldpulse:monitor  — Analyze multiple fields from a CSV
  /fieldpulse:report   — Summarize or convert a previous report
  /fieldpulse:explain  — Plain-English explanation of latest report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Parameters

| Parameter    | Required | Default | Description                                      |
|-------------|----------|---------|--------------------------------------------------|
| `--location` | Yes*     | —       | Place name or "lat,lon"                          |
| `--lat/--lon`| Yes*     | —       | Explicit coordinates (alternative to --location) |
| `--crop`     | No       | generic | wheat, rice, maize, soybean, cotton, generic     |
| `--radius`   | No       | 5       | Analysis radius in km (0.1–50)                   |
| `--months`   | No       | 12      | Historical window in months (3–24)               |

*Either --location or --lat/--lon is required.

## Examples

```
/fieldpulse:analyze "Punjab, India" --crop wheat --radius 10km
/fieldpulse:analyze --lat 30.9 --lon 75.8 --crop wheat
/fieldpulse:analyze "Mato Grosso, Brazil" --crop soybean --months 18
/fieldpulse:analyze "Kansas" --crop wheat
```

## Expected Runtime

30–90 seconds depending on Sentinel-2 scene availability and API response times.
A progress update is printed every 30 seconds if the analysis is still running.
