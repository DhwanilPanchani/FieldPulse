"""
FieldPulse — Input validation module.

MUST be called as the first operation in every MCP tool handler,
before any cache lookup, file I/O, or network call.
"""
import math

CROP_TYPES = {"wheat", "rice", "maize", "soybean", "cotton", "generic"}


def validate_coordinates(lat: float, lon: float) -> None:
    for name, val in [("lat", lat), ("lon", lon)]:
        if not isinstance(val, (int, float)):
            raise ValueError(f"{name} must be a number, got {type(val).__name__!r}")
        if math.isnan(val):
            raise ValueError(f"{name} cannot be NaN")
        if math.isinf(val):
            raise ValueError(f"{name} cannot be infinite")
    if not (-90 <= lat <= 90):
        raise ValueError(f"lat must be -90 to 90, got {lat}")
    if not (-180 <= lon <= 180):
        raise ValueError(f"lon must be -180 to 180, got {lon}")


def validate_field_inputs(
    lat: float,
    lon: float,
    radius_km: float = 5.0,
    months: int = 12,
    crop_type: str = "generic",
) -> None:
    """
    Validate all field analysis inputs.
    Raises ValueError with a clear message on any failure.
    """
    validate_coordinates(lat, lon)

    if not isinstance(radius_km, (int, float)):
        raise ValueError(f"radius_km must be a number, got {type(radius_km).__name__!r}")
    if math.isnan(radius_km) or math.isinf(radius_km):
        raise ValueError(f"radius_km cannot be NaN or infinite")
    if not (0.1 <= radius_km <= 50):
        raise ValueError(f"radius_km must be 0.1 to 50, got {radius_km}")

    if not isinstance(months, int):
        raise ValueError(f"months must be an integer, got {type(months).__name__!r}")
    if not (1 <= months <= 24):
        raise ValueError(f"months must be 1 to 24, got {months}")

    if crop_type not in CROP_TYPES:
        raise ValueError(
            f"crop_type must be one of {sorted(CROP_TYPES)}, got {crop_type!r}"
        )
