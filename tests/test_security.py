"""
Security-focused tests for FieldPulse.

Covers:
  - Path traversal prevention in cache module
  - Cache directory permissions
  - Cache write atomicity (no partial writes visible)
  - Input sanitisation prevents dangerous strings reaching the filesystem
"""

import json
import os
import sys
import tempfile
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "mcp_servers"))
import cache as cache_mod


# ── helpers ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def temp_cache_dir(tmp_path, monkeypatch):
    """Redirect cache to a temp directory for each test."""
    monkeypatch.setattr(cache_mod, "CACHE_DIR", tmp_path / "cache")
    monkeypatch.setattr(cache_mod, "LOG_DIR",   tmp_path / "logs")
    monkeypatch.setattr(cache_mod, "FIELDPULSE_HOME", tmp_path)
    monkeypatch.setattr(cache_mod, "_L1", {})
    cache_mod.ensure_dirs()
    return tmp_path


# ── path traversal ────────────────────────────────────────────────────────────

class TestPathTraversal:
    def test_normal_key_stays_in_cache_dir(self):
        path = cache_mod._safe_cache_path("ndvi_30.9000_75.8000_5.0_12")
        assert str(path).startswith(str(cache_mod.CACHE_DIR.resolve()))

    def test_traversal_with_dotdot_blocked(self):
        with pytest.raises(ValueError, match="traversal"):
            cache_mod._safe_cache_path("../../etc/cron.d/evil")

    def test_traversal_with_absolute_path_blocked(self):
        with pytest.raises(ValueError, match="traversal"):
            cache_mod._safe_cache_path("/etc/passwd")

    def test_traversal_with_url_encoded_blocked(self):
        # After sanitisation %2F becomes _, not /
        # The resulting key should be safe even if it looks like a path
        path = cache_mod._safe_cache_path("..%2F..%2Fetc%2Fpasswd")
        assert str(path).startswith(str(cache_mod.CACHE_DIR.resolve()))

    def test_key_with_slashes_sanitised(self):
        path = cache_mod._safe_cache_path("some/path/key")
        # Slashes converted to underscores — key stays inside cache dir
        assert "/" not in path.name.replace(str(cache_mod.CACHE_DIR), "")
        assert str(path).startswith(str(cache_mod.CACHE_DIR.resolve()))

    def test_key_truncated_at_128_chars(self):
        long_key = "a" * 300
        path = cache_mod._safe_cache_path(long_key)
        # stem = safe_key (128 chars) — no infinite filenames
        assert len(path.stem) <= 128

    def test_null_byte_in_key_sanitised(self):
        # Null bytes in filenames could cause issues on some filesystems
        path = cache_mod._safe_cache_path("key\x00evil")
        assert "\x00" not in str(path)


# ── cache file permissions ────────────────────────────────────────────────────

class TestCachePermissions:
    @pytest.mark.skipif(os.name == "nt", reason="POSIX permissions only")
    def test_cache_dir_is_owner_only(self):
        mode = oct(cache_mod.CACHE_DIR.stat().st_mode)[-3:]
        assert mode == "700", f"Expected 700, got {mode}"

    @pytest.mark.skipif(os.name == "nt", reason="POSIX permissions only")
    def test_cache_file_is_owner_only(self):
        cache_mod.set("test_key", {"value": 42}, ttl_seconds=3600)
        cache_file = next(cache_mod.CACHE_DIR.glob("*.json"), None)
        assert cache_file is not None, "Cache file was not written"
        mode = oct(cache_file.stat().st_mode)[-3:]
        assert mode == "600", f"Expected 600, got {mode}"


# ── cache TTL / expiry ────────────────────────────────────────────────────────

class TestCacheTTL:
    def test_fresh_cache_hit(self):
        cache_mod.set("mykey", {"data": "hello"}, ttl_seconds=300)
        result = cache_mod.get("mykey")
        assert result == {"data": "hello"}

    def test_expired_cache_miss(self):
        cache_mod.set("expkey", {"data": "stale"}, ttl_seconds=1)
        time.sleep(1.1)
        result = cache_mod.get("expkey")
        assert result is None

    def test_expired_file_removed(self):
        cache_mod.set("expfile", {"data": "stale"}, ttl_seconds=1)
        time.sleep(1.1)
        cache_mod.get("expfile")  # triggers cleanup
        remaining = list(cache_mod.CACHE_DIR.glob("expfile*.json"))
        assert remaining == []

    def test_l1_cache_serves_before_file(self, monkeypatch):
        cache_mod.set("l1key", {"source": "file"}, ttl_seconds=300)
        # Corrupt the file; L1 should still serve
        for f in cache_mod.CACHE_DIR.glob("l1key*.json"):
            f.write_text("corrupted", encoding="utf-8")
        result = cache_mod.get("l1key")
        assert result == {"source": "file"}  # served from L1

    def test_l2_file_restored_after_l1_miss(self):
        cache_mod.set("l2key", {"source": "disk"}, ttl_seconds=300)
        # Clear L1 manually
        cache_mod._L1.clear()
        result = cache_mod.get("l2key")
        assert result == {"source": "disk"}  # served from L2


# ── atomic write ─────────────────────────────────────────────────────────────

class TestAtomicWrite:
    def test_no_tmp_file_left_after_write(self):
        cache_mod.set("atomickey", {"v": 1}, ttl_seconds=300)
        tmp_files = list(cache_mod.CACHE_DIR.glob("*.tmp"))
        assert tmp_files == [], f"Unexpected .tmp files: {tmp_files}"
