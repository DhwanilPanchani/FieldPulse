# Skill: NDVI Analysis

## What NDVI Measures

NDVI (Normalised Difference Vegetation Index) = (NIR − Red) / (NIR + Red), range −1 to +1.

It is a proxy for chlorophyll density and canopy greenness. Values close to 1.0 indicate dense, actively photosynthesising vegetation. Values near 0 indicate bare soil. Values below 0 indicate water, snow, or urban surfaces.

**NDVI is not yield — it is a leading indicator.** Low NDVI relative to seasonal norms signals stress before yield is lost. This is why anomaly-relative-to-baseline is more informative than absolute NDVI.

---

## Absolute NDVI Ranges by Crop Stage

### Wheat (Triticum aestivum) — Rabi season, South Asia
Calibrated against Landsat/Sentinel-2 studies from Punjab and Haryana (India) in the literature.

| Phenological Stage    | Months (typical) | Healthy NDVI | Stressed NDVI | Critical NDVI |
|----------------------|-----------------|--------------|---------------|---------------|
| Bare field / sowing  | Oct–Nov         | 0.10–0.20    | < 0.10        | < 0.05        |
| Emergence            | Nov             | 0.20–0.35    | < 0.20        | < 0.15        |
| Vegetative           | Nov–Dec         | 0.45–0.65    | < 0.40        | < 0.30        |
| Jointing / booting   | Dec–Jan         | 0.65–0.80    | < 0.55        | < 0.45        |
| Heading / flowering  | Jan–Feb         | 0.75–0.85    | < 0.65        | < 0.55        |
| Grain fill           | Feb–Mar         | 0.65–0.80    | < 0.55        | < 0.45        |
| Senescence           | Mar–Apr         | 0.30–0.55    | —             | —             |

Source: Badarinath et al. (2010) "Remote sensing derived NDVI for wheat crop area estimation in Haryana"; Lobell et al. (2012).

### Rice (Oryza sativa) — Kharif season, South/Southeast Asia

| Stage            | Months    | Healthy NDVI | Stressed |
|-----------------|-----------|--------------|----------|
| Transplanting    | Jun–Jul   | 0.25–0.45    | < 0.25   |
| Tillering        | Jul–Aug   | 0.55–0.75    | < 0.50   |
| Panicle init.    | Aug       | 0.70–0.85    | < 0.60   |
| Heading/flowering| Aug–Sep   | 0.75–0.90    | < 0.65   |
| Grain fill       | Sep       | 0.60–0.80    | < 0.50   |
| Ripening         | Sep–Oct   | 0.35–0.55    | —        |

### Maize (Zea mays)

| Stage         | Healthy NDVI | Stressed |
|--------------|--------------|----------|
| Seedling      | 0.25–0.40    | < 0.20   |
| Vegetative    | 0.55–0.75    | < 0.45   |
| Silking       | 0.75–0.85    | < 0.65   |
| Grain fill    | 0.65–0.80    | < 0.55   |
| Dough stage   | 0.45–0.60    | < 0.35   |

### Soybean (Glycine max)

| Stage         | Healthy NDVI | Stressed |
|--------------|--------------|----------|
| Emergence     | 0.20–0.35    | < 0.18   |
| Vegetative    | 0.55–0.75    | < 0.45   |
| Flowering     | 0.70–0.85    | < 0.60   |
| Pod fill      | 0.65–0.80    | < 0.55   |
| Maturity      | 0.35–0.55    | —        |

---

## NDVI Anomaly Interpretation

Anomaly (%) = ((current_NDVI − baseline_NDVI) / |baseline_NDVI|) × 100

Baseline = same calendar month, one year prior. If prior-year data is unavailable, use 3-year rolling mean for the calendar month.

| Anomaly %      | Interpretation                                    | Risk Signal       |
|---------------|---------------------------------------------------|-------------------|
| > 0            | Above normal — favourable season                  | None              |
| −5 to 0        | Slightly below normal — within noise              | Watch             |
| −5 to −15      | Below normal — early stress signal                | Moderate concern  |
| −15 to −25     | Significantly below — likely moisture or heat stress | High concern   |
| −25 to −40     | Severe deficit — yield impact probable            | Severe            |
| < −40          | Extreme — crop failure possible in this area      | Critical          |

**Important**: Anomaly interpretation must account for phenological stage. A −20% anomaly at heading (wheat Jan–Feb) is far more damaging than the same anomaly at emergence.

---

## NDVI Risk Score Conversion (for fusion agent)

| Condition                                            | NDVI Risk Score |
|------------------------------------------------------|----------------|
| NDVI ≥ stage_healthy_min AND anomaly > −5%           | 0–10           |
| NDVI at stage_healthy_min AND anomaly −5% to −15%    | 15–25          |
| NDVI at stage_stressed AND anomaly −15% to −25%      | 35–50          |
| NDVI at stage_critical AND anomaly −25% to −40%      | 55–70          |
| NDVI < stage_critical OR anomaly < −40%              | 75–90          |

Use the HIGHER of the two sub-scores (NDVI absolute vs anomaly %).

---

## NDWI and EVI Modifiers

**NDWI** (Normalised Difference Water Index):
- NDWI > 0.1 : canopy water content adequate
- NDWI −0.1 to 0.1 : mild water stress — add 5 points to NDVI risk score
- NDWI −0.3 to −0.1 : moderate stress — add 10 points
- NDWI < −0.3 : severe canopy dehydration — add 20 points

**EVI** provides a less-saturated signal for dense canopies.
- Use EVI as the primary index when NDVI > 0.80 (saturation region).
- EVI > 0.5 = dense healthy canopy
- EVI 0.3–0.5 = moderate
- EVI < 0.2 = sparse or stressed vegetation

---

## Data Quality Notes

- **Cloud cover > 30%**: NDVI values may be contaminated by cloud shadows; treat as unreliable and note in output.
- **MODIS GIBS fallback**: Approximate NDVI from colour mapping has ±0.05 accuracy. Add 10 points to the NDVI risk score uncertainty. Do not flag anomaly from MODIS-sourced data alone.
- **Spatial averaging**: NDVI is averaged over the analysis radius. Heterogeneous fields (irrigated vs rainfed patches) will blur the signal. Note if radius > 20 km.
