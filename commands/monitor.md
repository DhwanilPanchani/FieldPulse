# /fieldpulse:monitor

Run analysis for one or more locations, with progress tracking and save-on-complete.

## Usage

```
/fieldpulse:monitor --location "<place>" --crop <crop> [--output-dir <path>]
/fieldpulse:monitor --batch-file <path.json> [--output-dir <path>]
```

## Parameters

| Parameter      | Required | Default                    | Description                             |
|---------------|----------|----------------------------|-----------------------------------------|
| `--location`   | Yes*     | —                          | Single location name or coordinates     |
| `--batch-file` | Yes*     | —                          | JSON file with multiple field entries   |
| `--crop`       | No       | generic                    | Crop type (for single location)         |
| `--output-dir` | No       | ./fieldpulse_reports/      | Directory for saved reports             |

*Either --location or --batch-file is required.

## Batch File Format

```json
[
  {"location": "Punjab, India",   "crop": "wheat",   "radius_km": 10},
  {"location": "Haryana, India",  "crop": "rice",    "radius_km": 8},
  {"location": "UP, India",       "crop": "wheat",   "radius_km": 15}
]
```

## Progress and Save Behaviour

1. Print the total count before starting:
   `"Starting batch analysis for [N] fields..."`

2. For each field, print before starting:
   `"[X/N] Analyzing: [field_name]..."`

3. **Save each report immediately after it completes** — do not wait for all fields.
   Filename: `{output_dir}/{field_slug}_{YYYYMMDD_HHMMSS}.md`

4. If the session is interrupted before all fields complete:
   Print: `"Analysis interrupted after [X/N] fields. Completed reports saved to: {output_dir}/"`

5. After all fields complete, print a summary table **sorted by risk level** (CRITICAL first, then SEVERE, HIGH, MODERATE, LOW):

```
| Field               | Risk      | Top Concern              | Report File                      |
|---------------------|-----------|--------------------------|----------------------------------|
| Punjab North        | CRITICAL  | Heat stress at flowering | fieldpulse_reports/punjab_n...   |
| Haryana East        | HIGH      | Low soil organic carbon  | fieldpulse_reports/haryana_e...  |
```

## Delta Reports

When the same location has been analyzed before (prior report found in output-dir):
- Compute score delta vs prior run
- Flag any factor that crossed a band boundary
- Report as: `"[field] risk changed from MODERATE → HIGH since [prior date]"`
