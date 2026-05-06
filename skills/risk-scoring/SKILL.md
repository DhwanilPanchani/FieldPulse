# Skill: Risk Scoring

## Overview

This is the master rubric for computing the FieldPulse composite risk score. It defines factor weights, phenological stage modifiers, and the fusion algebra. The fusion agent must load this file before computing any composite score.

---

## Factor Definitions

Four factors feed the composite score. Each is a 0–100 risk value (0 = no risk, 100 = critical):

| Factor ID | What it measures                            | Data source            |
|----------|---------------------------------------------|------------------------|
| `ndvi`   | Vegetation health relative to baseline       | satellite_mcp.py       |
| `water`  | Precipitation deficit + SPI-3 drought index  | weather_mcp.py         |
| `heat`   | Heat stress exposure (days ≥ 35°C)          | weather_mcp.py         |
| `soil`   | Soil degradation (OC, BD, pH, clay)          | soil_mcp.py            |

---

## Base Weight Matrix

Weights derived from agronomic yield response literature, calibrated to minimise RMSE on 10-year historical NDVI vs reported yield data from FAO GIEWS for South Asian crops.

**Rationale for each weight:**
- Water (0.30): Irrigation access is the primary yield determinant in semi-arid South Asia; rainfall variability drives most inter-annual yield fluctuation (Lobell et al. 2012).
- Heat (0.25): South Asia sits at the edge of the thermal comfort zone for C3 crops. Heat is the fastest-acting stressor — a single 40°C day at anthesis can abort > 40% of grain (Prasad et al. 2008).
- NDVI (0.25): NDVI integrates the effects of water + heat stress on the canopy. It is a lagging indicator — by the time NDVI drops, stress is already embedded. But it provides ground-truth signal that other factors may miss (pest damage, disease, uneven irrigation).
- Soil (0.20): Soil degrades slowly (years to decades). Its weight is lower in seasonal analysis but dominates multi-year trend assessments. Healthy soil amplifies resilience to all other stressors.

### Generic / Unknown Crop

| Factor | Weight |
|--------|--------|
| water  | 0.30   |
| heat   | 0.25   |
| ndvi   | 0.25   |
| soil   | 0.20   |

### Wheat (Triticum aestivum) — Rabi, South Asia

| Factor | Base Weight | Reasoning                                                   |
|--------|------------|-------------------------------------------------------------|
| water  | 0.30        | Wheat is deeply sensitive to soil moisture at tillering and grain fill |
| heat   | 0.28        | Slightly upweighted — wheat is highly vulnerable to post-anthesis heat (Tmax > 30°C) |
| ndvi   | 0.23        | Good integrating signal for wheat greenness; downweighted slightly relative to heat |
| soil   | 0.19        | Wheat can partially compensate via fertiliser; soil quality matters more over seasons |

### Rice (Oryza sativa) — Kharif, South/Southeast Asia

| Factor | Weight | Reasoning                                                        |
|--------|--------|------------------------------------------------------------------|
| water  | 0.35   | Rice is almost uniquely sensitive to water — paddy fields require continuous flooding |
| soil   | 0.25   | Puddling and organic matter are critical for paddy soil water retention |
| heat   | 0.22   | Heat stress at panicle initiation causes spikelet sterility      |
| ndvi   | 0.18   | Rice NDVI is a weaker signal than for dryland crops              |

### Maize (Zea mays) — Kharif

| Factor | Weight | Reasoning                                          |
|--------|--------|----------------------------------------------------|
| heat   | 0.30   | Maize is the most heat-sensitive major cereal       |
| water  | 0.30   | Silking requires soil moisture; deficit at this stage is catastrophic |
| ndvi   | 0.22   | Strong NDVI signal for maize canopy                |
| soil   | 0.18   | Less soil-limited than rice                        |

### Soybean (Glycine max)

| Factor | Weight | Reasoning                                              |
|--------|--------|--------------------------------------------------------|
| water  | 0.32   | Pod fill is critically water-limited                   |
| ndvi   | 0.25   | Dense canopy gives good NDVI signal                   |
| heat   | 0.25   | Heat stress at R1–R5 (flowering to pod fill) is severe |
| soil   | 0.18   | Nitrogen fixation reduces fertiliser dependence        |

---

## Phenological Stage Modifiers

The base weights above are for the mid-season. Adjust them using the modifiers below based on the current growth stage.

**Determination**: Infer the phenological stage from crop type + current calendar date + hemisphere.

### Wheat — Rabi (Punjab sowing dates: Oct 15 – Nov 15)

| Stage          | Dates (typical)   | Water mod | Heat mod | NDVI mod | Soil mod |
|---------------|-------------------|-----------|----------|----------|----------|
| Sowing/emerge  | Oct 15 – Nov 20   | ×1.4      | ×0.5     | ×0.5     | ×1.2     |
| Vegetative     | Nov 20 – Jan 10   | ×1.1      | ×0.8     | ×1.0     | ×1.0     |
| Jointing       | Jan 10 – Jan 25   | ×1.2      | ×1.1     | ×1.1     | ×0.9     |
| Heading/anthesis| Jan 25 – Feb 10  | ×1.2      | ×1.5     | ×1.2     | ×0.8     |
| Grain fill     | Feb 10 – Mar 10   | ×1.3      | ×1.4     | ×1.0     | ×0.8     |
| Harvest        | Mar 10 – Apr 10   | ×0.7      | ×0.8     | ×0.6     | ×0.7     |

**Example**: At anthesis (Jan 25 – Feb 10) for wheat, the heat modifier is ×1.5. If base heat weight = 0.28, the adjusted weight = 0.28 × 1.5 = 0.42. Renormalise all weights to sum to 1.0.

### Renormalisation after applying modifiers

```
adjusted_weights = {f: base_weights[f] × modifiers[stage][f] for f in factors}
sum_adj = sum(adjusted_weights.values())
final_weights = {f: adjusted_weights[f] / sum_adj for f in factors}
```

---

## Factor Score Computation

### NDVI Score

See `skills/ndvi-analysis/SKILL.md` for the full NDVI-to-score table. Summary:

| NDVI condition                              | Score |
|---------------------------------------------|-------|
| Healthy NDVI, anomaly > −5%                 | 0–10  |
| Slightly below healthy, anomaly −5 to −15%  | 15–25 |
| At or below stressed threshold              | 35–50 |
| At or below critical threshold              | 55–70 |
| Severe deficit or anomaly < −40%            | 75–90 |

### Water Score

See `skills/drought-index/SKILL.md` for SPI-3 and deficit tables. Use MAX of the two scores.

### Heat Score

Count days where Tmax ≥ 35°C in the last 3 months. Use growth-stage severity multiplier.

| Days ≥ 35°C (3-month window) | Base heat score |
|-----------------------------|-----------------|
| 0                            | 0               |
| 1–3                          | 20              |
| 4–7                          | 45              |
| 8–14                         | 70              |
| > 14                         | 90              |

Apply growth-stage multiplier: at anthesis, multiply by 1.3 before capping at 100.

Days ≥ 40°C contribute double (each day ≥ 40°C counts as 2 days in the above table).

### Soil Score

Comes directly from `soil_mcp.py`'s `degradation_score` (0–100). Use as-is.

---

## Composite Score Algebra

```
composite = Σ (final_weight[f] × factor_score[f])  for f in {ndvi, water, heat, soil}
```

All weights must sum to 1.0 after renormalisation.

**Missing factor handling**: If factor f is unavailable, remove it and redistribute proportionally:
```
remaining_weight = 1.0 - final_weight[f_missing]
new_weights = {f: final_weight[f] / remaining_weight for f in remaining factors}
```
Set `reduced_confidence = true` in the fusion output.

---

## Risk Band Thresholds

| Composite Score | Band      | Terminal colour | Farmer plain text      |
|----------------|-----------|-----------------|------------------------|
| 0–20            | LOW       | Green           | Crop is healthy; monitor normally |
| 21–40           | MODERATE  | Yellow          | Early warning; review irrigation |
| 41–60           | HIGH      | Orange          | Likely yield impact; act this week |
| 61–80           | SEVERE    | Red             | Significant crop loss probable    |
| 81–100          | CRITICAL  | Dark Red        | Immediate intervention required   |

---

## 30 / 60 / 90-Day Trajectory Projection

**30-day**: Use the 16-day forecast. Apply the following score deltas:
- Each forecast day ≥ 35°C: heat_score += 1.5 (capped at 100)
- Forecast water deficit > 40mm: water_score += 8
- NDVI trend = "declining" for 3+ consecutive months: ndvi_score += 5

**60-day**: Apply 30-day result + these persistent trends:
- Soil trend = "declining": soil_score += 5
- Drought class stays "moderate" or worse: water_score += 5

**90-day**: Use climatological SPI-3 for the season (from historical mean) as the forecast baseline.
- If historical SPI-3 for this calendar period is < −0.5: assume drought persists → water_score += 5
- Soil trend dominates at this horizon

Report confidence alongside each trajectory:
- 30-day: "high" (actual forecast data)
- 60-day: "medium" (trend extrapolation)
- 90-day: "low" (climatological baseline)

---

## Design Notes

**Why these weights and not others?**

The fusion weight design was informed by three sources:
1. Lobell et al. (2012, Science) — global sensitivity of crop yields to temperature vs precipitation: temperature (heat) and precipitation (water) together explain ~60% of yield variance.
2. Shiferaw et al. (2013) — wheat specifically in South Asia: water deficit is the #1 constraint, heat is #2, soil degradation is chronic background.
3. IPCC AR6 WG2 Chapter 5 (2022) — compound heat-drought events disproportionately reduce yields compared to individual stressors — justifying the non-linear multiplicative stage modifier at anthesis.

The NDVI weight (0.23–0.25) is intentionally conservative because NDVI is a symptom indicator, not a causal driver. Weighting it higher would create circular reasoning: stress causes low NDVI and low NDVI scores as stress.

The soil weight (0.18–0.20) is intentionally the lowest for seasonal analysis because SoilGrids provides a static snapshot and cannot track within-season changes. Its importance grows over multi-year monitoring intervals.
