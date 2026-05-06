"""
FieldPulse — File-based persistent cache with safe path handling.

Two-tier design:
  L1: in-process dict (TTL enforced on read) — zero latency
  L2: ~/.fieldpulse/cache/*.json — survives Claude Code session restarts

Security guarantees:
  - Cache directory created with 0o700 (owner-only)
  - Cache files created with 0o600 (owner-only)
  - Path traversal blocked: resolved path must be a child of CACHE_DIR
  - Cache keys are sanitised to alphanumeric + hyphen/underscore only
"""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

FIELDPULSE_HOME = Path.home() / ".fieldpulse"
CACHE_DIR       = FIELDPULSE_HOME / "cache"
LOG_DIR         = FIELDPULSE_HOME / "logs"

# In-process L1 cache: {key: (expires_at, data)}
_L1: dict[str, tuple[float, Any]] = {}


def ensure_dirs() -> None:
    CACHE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    LOG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Tighten permissions on home dir if we just created it
    try:
        os.chmod(str(FIELDPULSE_HOME), 0o700)
    except OSError:
        pass


def _safe_cache_path(cache_key: str) -> Path:
    """
    Return a safe absolute path for a cache file.
    Blocks path traversal: the resolved path must remain inside CACHE_DIR.
    """
    # Check the raw key before sanitisation strips the traversal evidence.
    # Only flag '..' when adjacent to a real path separator (not URL-encoded ones).
    if re.search(r'(^|[/\\])\.\.([/\\]|$)', cache_key) or cache_key.startswith("/"):
        raise ValueError(f"Cache path traversal blocked for key: {cache_key!r}")
    safe_key = re.sub(r"[^a-zA-Z0-9_\-]", "_", cache_key)[:128]
    candidate = (CACHE_DIR / f"{safe_key}.json").resolve()
    # Defence-in-depth: resolved path must still be inside CACHE_DIR
    if not str(candidate).startswith(str(CACHE_DIR.resolve())):
        raise ValueError(f"Cache path traversal blocked for key: {cache_key!r}")
    return candidate


def get(cache_key: str) -> Any | None:
    """Return cached data if still valid, else None."""
    now = time.time()

    # L1 check
    if cache_key in _L1:
        expires_at, data = _L1[cache_key]
        if now < expires_at:
            return data
        del _L1[cache_key]

    # L2 check (file)
    try:
        path = _safe_cache_path(cache_key)
        payload = json.loads(path.read_text(encoding="utf-8"))
        if now < payload["expires_at"]:
            _L1[cache_key] = (payload["expires_at"], payload["data"])
            return payload["data"]
        path.unlink(missing_ok=True)
    except ValueError:
        raise  # path traversal must never be silenced
    except (FileNotFoundError, KeyError, json.JSONDecodeError, OSError):
        pass

    return None


def set(cache_key: str, data: Any, ttl_seconds: int) -> None:
    """Write data to both L1 and L2 cache with a TTL."""
    expires_at = time.time() + ttl_seconds

    # L1
    _L1[cache_key] = (expires_at, data)

    # L2 — write atomically via temp file
    ensure_dirs()
    try:
        path = _safe_cache_path(cache_key)
        tmp  = path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({"expires_at": expires_at, "data": data}),
            encoding="utf-8",
        )
        tmp.chmod(0o600)
        tmp.rename(path)
    except ValueError:
        raise  # path traversal must never be silenced
    except OSError:
        pass   # L2 write failure is non-fatal; L1 still serves the data
