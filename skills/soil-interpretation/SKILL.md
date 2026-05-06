# Skill: Soil Interpretation

## Reading SoilGrids Output

ISRIC SoilGrids v2.0 provides soil property estimates at 250 m resolution using machine learning trained on 230,000+ soil profiles from the WoSIS database.

**Unit conversions** (raw SoilGrids integers → human-readable):

| Property | SoilGrids Unit | Conversion      | Display Unit |
|---------|---------------|-----------------|--------------|
| `soc`   | dg/kg         | ÷ 10            | g/kg         |
| `phh2o` | pH × 10       | ÷ 10            | pH           |
| `clay`  | g/kg          | ÷ 10            | %            |
| `bdod`  | cg/cm³        | ÷ 100           | g/cm³        |

**Depth interpretation**:
- 0–5 cm: Surface layer — most sensitive to management, drives microbial activity
- 5–15 cm: Upper plough layer — most agronomically important
- 15–30 cm: Lower plough layer — structural integrity, root depth indicator
- Depth-weighted mean (0–30 cm): Use for single-number reporting

---

## Soil Organic Carbon (SOC / OC)

Units: g/kg (grams of carbon per kilogram of soil)

### Why it matters
SOC drives: cation exchange capacity, water-holding capacity, microbial activity, and nitrogen cycling. A 1 g/kg increase in SOC increases plant-available water by ~0.4 mm/cm of soil (Minasny & McBratney 2018). Below 6 g/kg, South Asian soils show significant yield depression regardless of fertiliser inputs.

### Interpretation table (0–30 cm weighted mean)

| SOC (g/kg) | Status          | Implication for Wheat/Rice         |
|-----------|-----------------|-------------------------------------|
| > 20       | Very high       | Excellent water/nutrient buffering  |
| 15–20      | High            | Good                                |
| 10–15      | Moderate        | Adequate; watch for decline         |
| 6–10       | Low             | Yield drag; fertiliser efficiency ↓ |
| 3–6        | Degraded        | FAO "degraded" threshold; yield loss probable |
| < 3        | Severely degraded | Near-desertification state; reclamation needed |

Source: FAO/ITPS (2015) "Status of the World's Soil Resources", Chapter 7 (South Asia); Lal (2016) Geoderma.

### Optimal ranges by crop

| Crop    | Minimum (g/kg) | Optimal (g/kg) |
|---------|---------------|----------------|
| Wheat   | 6             | 10–20          |
| Rice    | 8             | 12–25          |
| Maize   | 5             | 8–18           |
| Soybean | 8             | 12–22          |

---

## pH (H₂O)

### Why it matters
pH controls nutrient availability. At pH < 5.5, aluminium and manganese become soluble and toxic. At pH > 8.0, phosphorus, iron, and zinc precipitate and become unavailable. Wheat is the most pH-sensitive staple at flowering.

### Interpretation table

| pH      | Impact                                              |
|---------|-----------------------------------------------------|
| < 4.5   | Severe Al/Mn toxicity; most crops fail              |
| 4.5–5.0 | High toxicity; only acid-tolerant varieties survive |
| 5.0–5.5 | Moderate toxicity; significant yield loss           |
| 5.5–6.0 | Mild acidity; P and Mo slightly limited             |
| 6.0–7.0 | Optimal for most crops                              |
| 7.0–7.5 | Slight alkalinity; minor P reduction                |
| 7.5–8.0 | Moderate alkalinity; Zn/Fe deficiency likely        |
| 8.0–8.5 | High alkalinity; P, Fe, Mn deficiency probable      |
| > 8.5   | Saline/sodic; severe nutrient lockout               |

Source: Brady & Weil (2016) "The Nature and Properties of Soils", 15th ed.

---

## Bulk Density (BDOD)

Units: g/cm³ (grams per cubic centimetre of undisturbed soil)

### Why it matters
Bulk density is the primary indicator of soil compaction. High BD mechanically restricts root elongation and reduces macropore space for air and water movement. Compaction in the plough layer reduces effective rooting depth, dramatically increasing drought sensitivity.

### Interpretation table

| BDOD (g/cm³) | Status                    | Root penetration              |
|-------------|---------------------------|-------------------------------|
| < 1.20       | Very loose                | Unrestricted                  |
| 1.20–1.35    | Normal                    | Good                          |
| 1.35–1.45    | Slightly compacted        | Minor restriction             |
| 1.45–1.55    | Compacted                 | Moderate restriction          |
| 1.55–1.65    | Severely compacted        | >50% root growth restricted   |
| > 1.65       | Critical compaction       | Near-zero penetration in loam |

Source: USDA-NRCS Soil Quality Indicators (2008); Hamza & Anderson (2005) Soil & Tillage Research 82:121–145.

**Note**: Compaction threshold varies by texture. Sandy soils compact at lower BD (1.60+), clays at slightly higher (1.50+). The values above are for loam/silt loam, which covers most South Asian agricultural soils.

---

## Clay Fraction

Units: % (grams of clay per 100 g soil)

### Why it matters
Clay is the mineralogical backbone of soil fertility — it holds cations and water. Too little clay → droughty, nutrient-leaching soils. Too much → waterlogging, poor aeration, difficult tillage.

### Interpretation table

| Clay %     | Texture Class         | Agronomic Impact                     |
|-----------|----------------------|--------------------------------------|
| < 10       | Sandy                | Very low WHC; high drought risk       |
| 10–18      | Sandy loam           | Low WHC; needs irrigation management |
| 18–28      | Loam                 | Ideal for most grain crops            |
| 28–40      | Clay loam            | Good; drainage management needed     |
| 40–55      | Clay                 | Waterlogging risk; restricted aeration|
| > 55       | Heavy clay           | Cracking; tillage problems            |

---

## Confidence Interval Interpretation

SoilGrids reports Q5 and Q95 quantiles alongside the mean.

**Confidence interval width** = Q95 − Q5

| CI Width / Mean | Interpretation                                    |
|----------------|---------------------------------------------------|
| < 0.5×          | High confidence — well-sampled area               |
| 0.5–1.0×        | Moderate confidence — interpret with caution      |
| > 1.0×          | Low confidence — flag in report; do not use as primary risk driver |

Low-confidence SOC readings are common in areas with sparse profile density (remote regions, complex terrain). In low-confidence cases, use the conservative (lower) end of the range for risk scoring.

---

## Degradation Score Reference (for fusion agent)

The soil degradation score (0–100) is computed in `soil_mcp.py` using:
- SOC score × 0.40
- BDOD score × 0.30
- pH score × 0.20
- Clay score × 0.10

When interpreting the output:
- Score 0–20: Healthy soils; no immediate action required
- Score 21–40: Mild degradation; monitor SOC trends
- Score 41–60: Moderate degradation; soil amendment programme recommended
- Score 61–80: Severe degradation; immediate remediation needed (compost, cover crops)
- Score 81–100: Critical; yield recovery without major intervention is unlikely
