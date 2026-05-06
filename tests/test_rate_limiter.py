"""
Tests for the async rate limiter.

Verifies that rapid consecutive calls are spaced at least 1/calls_per_second apart.
"""

import asyncio
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "mcp_servers"))
from rate_limiter import AsyncRateLimiter


@pytest.mark.asyncio
async def test_calls_are_spaced():
    limiter = AsyncRateLimiter(calls_per_second=5.0)
    timestamps = []

    for _ in range(5):
        await limiter.acquire()
        timestamps.append(time.monotonic())

    gaps = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
    min_expected_gap = 1.0 / 5.0  # 0.2 s

    for gap in gaps:
        assert gap >= min_expected_gap * 0.9, f"Gap too small: {gap:.3f}s (expected ≥{min_expected_gap:.3f}s)"


@pytest.mark.asyncio
async def test_single_acquire_does_not_block():
    limiter = AsyncRateLimiter(calls_per_second=10.0)
    start = time.monotonic()
    await limiter.acquire()
    elapsed = time.monotonic() - start
    # First call should complete almost immediately
    assert elapsed < 0.5, f"First acquire took too long: {elapsed:.3f}s"


@pytest.mark.asyncio
async def test_concurrent_acquires_are_serialised():
    """Multiple concurrent acquires must not bypass the rate limit."""
    limiter = AsyncRateLimiter(calls_per_second=3.0)
    timestamps = []

    async def task():
        await limiter.acquire()
        timestamps.append(time.monotonic())

    await asyncio.gather(*[task() for _ in range(4)])
    gaps = sorted([timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)])
    # All gaps should be at least 0.3 s (1/3 calls_per_second)
    for gap in gaps:
        assert gap >= (1.0 / 3.0) * 0.8, f"Concurrent acquire too fast: {gap:.3f}s"
