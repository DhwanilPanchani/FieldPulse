"""
Tests for mcp_servers/validators.py

Covers all invalid inputs, edge cases, and valid boundary values.
No external network calls. No MCP server startup required.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "mcp_servers"))
from validators import validate_coordinates, validate_field_inputs, CROP_TYPES


# ── validate_coordinates ─────────────────────────────────────────────────────

class TestValidateCoordinates:
    def test_valid_origin(self):
        validate_coordinates(0.0, 0.0)  # Should not raise

    def test_valid_extreme_lat(self):
        validate_coordinates(90.0, 0.0)
        validate_coordinates(-90.0, 0.0)

    def test_valid_extreme_lon(self):
        validate_coordinates(0.0, 180.0)
        validate_coordinates(0.0, -180.0)

    def test_valid_punjab(self):
        validate_coordinates(30.9, 75.8)

    def test_nan_lat(self):
        with pytest.raises(ValueError, match="NaN"):
            validate_coordinates(float("nan"), 0.0)

    def test_nan_lon(self):
        with pytest.raises(ValueError, match="NaN"):
            validate_coordinates(0.0, float("nan"))

    def test_inf_lat(self):
        with pytest.raises(ValueError, match="infinite"):
            validate_coordinates(float("inf"), 0.0)

    def test_neg_inf_lon(self):
        with pytest.raises(ValueError, match="infinite"):
            validate_coordinates(0.0, float("-inf"))

    def test_lat_too_high(self):
        with pytest.raises(ValueError, match="lat must be -90 to 90"):
            validate_coordinates(91.0, 0.0)

    def test_lat_too_low(self):
        with pytest.raises(ValueError, match="lat must be -90 to 90"):
            validate_coordinates(-91.0, 0.0)

    def test_lon_too_high(self):
        with pytest.raises(ValueError, match="lon must be -180 to 180"):
            validate_coordinates(0.0, 181.0)

    def test_lon_too_low(self):
        with pytest.raises(ValueError, match="lon must be -180 to 180"):
            validate_coordinates(0.0, -181.0)

    def test_non_numeric_lat(self):
        with pytest.raises((ValueError, TypeError)):
            validate_coordinates("28.5", 0.0)  # type: ignore

    def test_large_invalid_lat(self):
        with pytest.raises(ValueError):
            validate_coordinates(999.0, 0.0)


# ── validate_field_inputs ────────────────────────────────────────────────────

class TestValidateFieldInputs:
    def test_valid_defaults(self):
        validate_field_inputs(30.9, 75.8)

    def test_valid_all_params(self):
        validate_field_inputs(30.9, 75.8, radius_km=10.0, months=12, crop_type="wheat")

    def test_valid_boundary_radius_min(self):
        validate_field_inputs(0.0, 0.0, radius_km=0.1)

    def test_valid_boundary_radius_max(self):
        validate_field_inputs(0.0, 0.0, radius_km=50.0)

    def test_radius_too_small(self):
        with pytest.raises(ValueError, match="radius_km"):
            validate_field_inputs(0.0, 0.0, radius_km=0.0)

    def test_radius_too_large(self):
        with pytest.raises(ValueError, match="radius_km"):
            validate_field_inputs(0.0, 0.0, radius_km=51.0)

    def test_radius_nan(self):
        with pytest.raises(ValueError):
            validate_field_inputs(0.0, 0.0, radius_km=float("nan"))

    def test_radius_inf(self):
        with pytest.raises(ValueError):
            validate_field_inputs(0.0, 0.0, radius_km=float("inf"))

    def test_months_min(self):
        validate_field_inputs(0.0, 0.0, months=1)

    def test_months_max(self):
        validate_field_inputs(0.0, 0.0, months=24)

    def test_months_zero(self):
        with pytest.raises(ValueError, match="months"):
            validate_field_inputs(0.0, 0.0, months=0)

    def test_months_too_large(self):
        with pytest.raises(ValueError, match="months"):
            validate_field_inputs(0.0, 0.0, months=25)

    def test_months_not_int(self):
        with pytest.raises((ValueError, TypeError)):
            validate_field_inputs(0.0, 0.0, months=12.5)  # type: ignore

    def test_valid_all_crop_types(self):
        for crop in CROP_TYPES:
            validate_field_inputs(0.0, 0.0, crop_type=crop)

    def test_invalid_crop_type(self):
        with pytest.raises(ValueError, match="crop_type"):
            validate_field_inputs(0.0, 0.0, crop_type="mango")

    def test_invalid_crop_empty_string(self):
        with pytest.raises(ValueError, match="crop_type"):
            validate_field_inputs(0.0, 0.0, crop_type="")

    def test_validation_order_nan_lat_not_cached(self):
        # Even if a cache entry existed, validation must fire first.
        # Passing NaN lat should raise BEFORE any cache lookup.
        with pytest.raises(ValueError, match="NaN"):
            validate_field_inputs(float("nan"), 75.8, radius_km=5.0)
