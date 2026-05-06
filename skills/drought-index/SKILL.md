# Skill: Drought Index

## SPI-3 (Standardised Precipitation Index, 3-month window)

### What it measures

SPI-3 measures how anomalous the 3-month cumulative precipitation is relative to the historical distribution at the same location and calendar period. It is dimensionless — a positive value means above-average rainfall, negative means below.

**Why 3 months?** SPI-3 tracks soil moisture and short-term agricultural drought better than SPI-1 (too noisy) or SPI-6 (too lagged). It responds to month-scale rainfall deficits that threaten crop water supply within a single growing season.

Reference: McKee, Doesken & Kleist (1993), "The relationship of drought frequency and duration to time scales." Proceedings 8th Conference Applied Climatology, AMS.

### SPI-3 Classification

| SPI-3 Value | Class            | Frequency (approx.) | Agricultural Impact              |
|------------|-----------------|---------------------|----------------------------------|
| ≥ 2.0      | Extremely wet    | 2%                  | Potential waterlogging            |
| 1.5–2.0    | Very wet         | 5%                  | Excess moisture                   |
| 1.0–1.5    | Moderately wet   | 9%                  | Favourable                        |
| −0.99–0.99 | Near normal      | 68%                 | Baseline                          |
| −1.0 to −1.5| Moderate drought| 9%                  | Reduced yield 10–20%              |
| −1.5 to −2.0| Severe drought  | 5%                  | Yield loss 20–50% without irrigation |
| < −2.0     | Extreme drought  | 2%                  | Crop failure likely without irrigation |

### Limitations of the FieldPulse SPI implementation

The `weather_mcp.py` implementation uses a normal-distribution approximation with a rolling z-score. This is computationally simple but slightly less accurate than the gamma distribution fit used in official WMO SPI tools. The deviation is < 0.1 SPI units for most conditions. For SPI < −2.0 (extreme), the approximation slightly underestimates severity; add a conservative +0.1 adjustment when classifying as "extreme".

---

## Water Deficit (ET₀ − Precipitation)

### Reference Evapotranspiration (ET₀)

Open-Meteo provides FAO Penman-Monteith ET₀ directly. This is the evapotranspiration from a hypothetical reference grass surface — it represents atmospheric evaporative demand.

**Crop water demand** = ET₀ × Kc (crop coefficient)

Crop coefficients for key crops (FAO Irrigation and Drainage Paper 56):

| Crop    | Initial (Kc_ini) | Mid-season (Kc_mid) | Late season (Kc_end) |
|---------|-----------------|--------------------|--------------------|
| Wheat   | 0.30            | 1.15               | 0.25–0.40          |
| Rice    | 1.05            | 1.20               | 0.90–1.05          |
| Maize   | 0.30            | 1.20               | 0.35–0.60          |
| Soybean | 0.40            | 1.15               | 0.50               |

### Water Deficit Interpretation (monthly, mm)

Positive deficit = ET₀ > precipitation = crop demand exceeds rainfall supply.

| Monthly Deficit (mm) | Impact                                              |
|---------------------|-----------------------------------------------------|
| < 0 (surplus)        | Adequate moisture; waterlogging risk if sustained   |
| 0–20                 | Minor deficit; typically covered by soil water reserves |
| 20–50                | Moderate deficit; irrigation recommended            |
| 50–100               | Significant stress; yield impact without irrigation |
| 100–150              | Severe deficit; major yield loss expected           |
| > 150                | Extreme — emergency irrigation required             |

**Cumulative deficit matters more than monthly**: A 30mm monthly deficit sustained over 3 months is more damaging than a single 90mm deficit month with good bookend rainfall.

---

## Drought Score Conversion (for fusion agent)

Use the MAXIMUM of the SPI-3 score and the water deficit score:

### SPI-3 Water Stress Score

| SPI-3            | Water Stress Score |
|-----------------|--------------------|
| ≥ −0.5           | 0                  |
| −0.5 to −1.0     | 20                 |
| −1.0 to −1.5     | 45                 |
| −1.5 to −2.0     | 70                 |
| < −2.0           | 90                 |

### Cumulative 3-Month Water Deficit Score

| 3-month Deficit (mm) | Score |
|---------------------|-------|
| < 30                 | 0     |
| 30–60                | 20    |
| 60–100               | 40    |
| 100–150              | 65    |
| > 150                | 85    |

**Final water stress score** = max(SPI-3 score, deficit score)

---

## Seasonal Drought Calendar for South Asia

| Month       | Expected SPI-3 (normal year) | Key crop sensitivity           |
|------------|------------------------------|-------------------------------|
| Jun–Aug     | +0.5 to +1.5 (monsoon)       | Kharif crops (rice, maize)    |
| Sep–Oct     | +0.2 to +0.8 (post-monsoon)  | Late Kharif maturation        |
| Nov–Jan     | −0.2 to +0.2 (rabi season)   | Wheat establishment           |
| Feb–Mar     | −0.5 to 0.0 (dry season)     | Wheat grain fill — critical   |
| Apr–May     | −0.8 to −0.3 (pre-monsoon)   | Harvest stress                |

A Feb–Mar SPI-3 < −1.0 in Punjab/Haryana is a strong predictor of below-average wheat yield.

---

## Cross-referencing with NDVI

Drought without NDVI depression may indicate surface irrigation masking the rainfall deficit — common in Punjab. When SPI-3 < −1.5 but NDVI anomaly is < −10%, irrigation is likely compensating. Flag this in the report as "drought risk mitigated by irrigation infrastructure."

When both SPI-3 < −1.0 AND NDVI anomaly < −15%, the combined signal is a strong indicator of realised crop stress, not just atmospheric drought.
