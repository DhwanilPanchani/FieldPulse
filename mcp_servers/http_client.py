"""
FieldPulse — Shared httpx client factory.

All MCP servers must use get_client() instead of constructing
httpx.AsyncClient() directly. This enforces consistent timeouts,
User-Agent headers, and redirect behaviour across all external API calls.
"""
import httpx

TIMEOUT = httpx.Timeout(
    connect=5.0,   # 5 s to establish TCP connection
    read=25.0,     # 25 s to receive response body (satellite COG reads can be large)
    write=5.0,
    pool=5.0,
)

_USER_AGENT = "FieldPulse/1.0 (github.com/DhwanilPanchani/fieldpulse; open-source ag-intelligence)"


def get_client() -> httpx.AsyncClient:
    """Return a configured async httpx client. Use as an async context manager."""
    return httpx.AsyncClient(
        timeout=TIMEOUT,
        headers={"User-Agent": _USER_AGENT},
        follow_redirects=True,
    )
