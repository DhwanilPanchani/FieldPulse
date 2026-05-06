"""
Tests for MCP server error handling.

Verifies that each MCP server returns structured error objects (not unhandled exceptions)
for: network timeouts, HTTP errors, and unexpected runtime errors.

Uses unittest.mock to patch httpx without making real network calls.
"""

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "mcp_servers"))


# ── helpers ───────────────────────────────────────────────────────────────────

def parse_result(text_content_list) -> dict:
    """Parse the JSON from a list[TextContent] MCP tool response."""
    return json.loads(text_content_list[0].text)


# ── soil_mcp error handling ───────────────────────────────────────────────────

class TestSoilMCPErrors:
    @pytest.mark.asyncio
    async def test_validation_error_returned_not_raised(self):
        import soil_mcp
        result_list = await soil_mcp.call_tool("get_soil_profile", {"lat": 999.0, "lon": 0.0})
        result = parse_result(result_list)
        assert result["error"] == "input_validation_error"
        assert "lat" in result["message"].lower()
        assert result["recoverable"] is False

    @pytest.mark.asyncio
    async def test_nan_lat_validation_error(self):
        import soil_mcp
        result_list = await soil_mcp.call_tool("get_soil_profile", {"lat": float("nan"), "lon": 0.0})
        result = parse_result(result_list)
        assert result["error"] == "input_validation_error"

    @pytest.mark.asyncio
    async def test_timeout_returns_structured_error(self):
        import soil_mcp
        with patch("soil_mcp.get_client") as mock_client_factory:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
            mock_client_factory.return_value = mock_client
            # Clear L1 cache
            import cache as _c
            _c._L1.clear()
            result_list = await soil_mcp.call_tool("get_soil_profile", {"lat": 30.9, "lon": 75.8})
            result = parse_result(result_list)
            assert "error" not in result, "Should not return error — regional baseline should cover"
            assert "_baseline" in result["source"]
            assert result["org_carbon_g_per_kg"] is not None
            assert result["data_confidence"] == "low"
            assert "warning" in result

    @pytest.mark.asyncio
    async def test_http_429_returns_structured_error(self):
        import soil_mcp
        mock_response = MagicMock()
        mock_response.status_code = 429
        with patch("soil_mcp.get_client") as mock_client_factory:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                side_effect=httpx.HTTPStatusError("rate limited", request=MagicMock(), response=mock_response)
            )
            mock_client_factory.return_value = mock_client
            import cache as _c
            _c._L1.clear()
            result_list = await soil_mcp.call_tool("get_soil_profile", {"lat": 30.9, "lon": 75.8})
            result = parse_result(result_list)
            assert "error" not in result, "Should not return error — regional baseline should cover"
            assert "_baseline" in result["source"]
            assert result["org_carbon_g_per_kg"] is not None
            assert result["data_confidence"] == "low"
            assert "warning" in result

    @pytest.mark.asyncio
    async def test_unexpected_error_returns_structured_error(self):
        import soil_mcp
        with patch("soil_mcp.get_client") as mock_client_factory:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=RuntimeError("unexpected boom"))
            mock_client_factory.return_value = mock_client
            import cache as _c
            _c._L1.clear()
            result_list = await soil_mcp.call_tool("get_soil_profile", {"lat": 30.9, "lon": 75.8})
            result = parse_result(result_list)
            assert "error" not in result, "Should not return error — regional baseline should cover"
            assert "_baseline" in result["source"]
            assert result["org_carbon_g_per_kg"] is not None
            assert result["data_confidence"] == "low"
            assert "warning" in result


# ── weather_mcp error handling ────────────────────────────────────────────────

class TestWeatherMCPErrors:
    @pytest.mark.asyncio
    async def test_validation_error_on_bad_lat(self):
        import weather_mcp
        result_list = await weather_mcp.call_tool("get_climate_history", {"lat": -200.0, "lon": 0.0})
        result = parse_result(result_list)
        assert result["error"] == "input_validation_error"

    @pytest.mark.asyncio
    async def test_timeout_handled(self):
        import weather_mcp
        with patch("weather_mcp.get_client") as mock_client_factory:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            mock_client_factory.return_value = mock_client
            import cache as _c
            _c._L1.clear()
            result_list = await weather_mcp.call_tool("get_climate_history", {"lat": 30.9, "lon": 75.8})
            result = parse_result(result_list)
            assert result["error"] == "api_timeout"

    @pytest.mark.asyncio
    async def test_unknown_tool_name(self):
        import weather_mcp
        result_list = await weather_mcp.call_tool("nonexistent_tool", {"lat": 0.0, "lon": 0.0})
        result = parse_result(result_list)
        assert result["error"] == "unknown_tool"
