# /fieldpulse:explain

Give a plain-English explanation of the most recent risk assessment.

## Usage

```
/fieldpulse:explain [--factor <factor>] [--term <term>] [--what-if <scenario>]
```

## NO PRIOR REPORT CASE

If no FieldPulse report file exists in the current directory or `./fieldpulse_reports/`:
- DO NOT throw a file error
- Respond: "No FieldPulse analysis found in this directory. Run `/fieldpulse:analyze` first to generate a report."

## LANGUAGE RULES (Non-negotiable)

These rules apply to every explain response without exception:

- **Never use unexplained abbreviations.** The words NDVI, NDWI, EVI, SOC, SPI, SPEI, ET0, SPI-3, or any other technical abbreviation must not appear unless immediately followed by a plain-English explanation in parentheses.
- **Replace technical phrases with farmer-accessible language:**
  - ❌ "NDVI is -12% below baseline"  
    ✅ "The satellite shows your crops are noticeably less green than they normally are this time of year — about 12% below what we'd expect."
  - ❌ "Soil organic carbon is 2.1 g/kg, below regional median"  
    ✅ "Your soil has lower-than-normal levels of the organic matter that helps it hold water and feed plant roots. Healthy farmland typically has at least 6 g/kg; yours has 2.1."
  - ❌ "Forecast ET0 exceeds precipitation"  
    ✅ "Over the next two weeks, more water will evaporate from your soil than rain will replace."
  - ❌ "SPI-3 = -1.8 indicates severe drought"  
    ✅ "Over the past three months, your area has received significantly less rain than usual — enough to classify as a severe drought by standard meteorological measures."

- **Assume the reader is intelligent but not technical.** Explain the mechanism, not just the label.

## Default Behaviour (No Flags)

Load the most recent report from `./fieldpulse_reports/` and explain:
1. Why the overall risk level was assigned — walk through the top 3 contributing factors
2. What the 30-day trajectory means in practical terms for this crop right now
3. The single most impactful action the farmer or land manager should take

## Factor Deep-Dives

- `--factor ndvi`: Explain what the satellite greenness reading means for this crop at this time of year, and whether the anomaly is alarming or within normal variation
- `--factor soil`: Explain what the soil organic carbon, compaction, and pH readings mean for water-holding and plant feeding ability
- `--factor water`: Explain the rainfall deficit in terms of how much irrigation would be needed to compensate
- `--factor heat`: Explain which growth stage was exposed to heat, how many days exceeded safe limits, and what that means for yield

## What-If Scenarios

The `--what-if` flag re-runs the fusion with the specified modification applied to the relevant factor score. It does not re-fetch API data.

Examples:
```
/fieldpulse:explain --what-if "what if we apply 50mm of irrigation over the next 2 weeks?"
/fieldpulse:explain --what-if "what if temperatures stay 3°C above average through harvest?"
/fieldpulse:explain --what-if "we planted a cover crop last season that added 2 g/kg of organic carbon"
```

For each what-if, respond with:
1. How the factor score changes
2. How the composite score changes
3. Whether it changes the risk band
4. What else would need to change to reach the next lower risk level
