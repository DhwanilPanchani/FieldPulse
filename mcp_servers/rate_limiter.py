"""
FieldPulse — Async rate limiter for free public APIs.

Each external service gets its own rate limiter instance.
All MCP servers must call await LIMITER.acquire() before
every outbound API request to prevent IP bans during batch runs.
"""
import asyncio
import time
from dataclasses import dataclass, field


@dataclass
class AsyncRateLimiter:
    calls_per_second: float = 1.5
    _last_call: float = field(default=0.0, init=False, repr=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False, repr=False)

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            wait = (1.0 / self.calls_per_second) - (now - self._last_call)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()


# One instance per external service — Conservative for free-tier APIs.
# Copernicus / Planetary Computer: 1 req/s (STAC is strict during high load)
# SoilGrids: 2 req/s (well-documented rate limit)
# Open-Meteo: 3 req/s (most permissive; they allow 10 000 req/day free)
SENTINEL_LIMITER   = AsyncRateLimiter(calls_per_second=1.0)
SOILGRIDS_LIMITER  = AsyncRateLimiter(calls_per_second=2.0)
OPENMETEO_LIMITER  = AsyncRateLimiter(calls_per_second=3.0)
