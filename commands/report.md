# /fieldpulse:report

Generate or re-render a formatted report from a previous analysis or from raw data on disk.

## Usage

```
/fieldpulse:report [--from-file <path>] [--format md|html] [--include-raw]
```

## Parameters

| Parameter      | Required | Default | Description                                             |
|---------------|----------|---------|---------------------------------------------------------|
| `--from-file`  | No       | latest  | Path to a prior `fieldpulse_report_*.md` to re-render |
| `--format`     | No       | md      | Output format: md (Markdown) or html                    |
| `--include-raw`| No       | false   | Append raw API data tables to the report                |

## Behaviour

**Without `--from-file`**: Re-renders the most recent analysis in the current directory using the last-saved data payloads (no new API calls).

**With `--from-file`**: Parses the specified report file and reformats it — useful for converting a Markdown report to HTML or adding the raw data appendix.

## HTML Output

When `--format html` is specified, the report is rendered as a self-contained HTML file with:
- Colour-coded risk badges (LOW/MODERATE/HIGH/SEVERE/CRITICAL)
- A simple bar chart of factor scores (inline SVG, no external dependencies)
- Expandable raw data section

The HTML file is saved alongside the Markdown file as `fieldpulse_report_[location]_[date].html`.

## Notes

This command never re-fetches data from APIs. It only reformats existing analysis output. To run a fresh analysis, use `/fieldpulse:analyze`.
