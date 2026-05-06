#!/usr/bin/env python3
"""
FieldPulse setup script — works on Windows, macOS, and Linux.

Usage:
    python scripts/setup.py

What it does:
  1. Verifies Python 3.9+
  2. Creates an isolated venv at ~/.fieldpulse/venv
  3. Installs pinned dependencies from requirements.lock.txt (with hash verification)
     or falls back to requirements.txt
  4. Creates ~/.fieldpulse/{cache,logs}/ with safe permissions
  5. Verifies Claude Code is available
  6. Runs import smoke-test on each MCP server module
"""

import os
import platform
import subprocess
import sys
from pathlib import Path

MIN_PYTHON       = (3, 9)
PLUGIN_ROOT      = Path(__file__).resolve().parent.parent
FIELDPULSE_HOME  = Path.home() / ".fieldpulse"
VENV_DIR         = FIELDPULSE_HOME / "venv"
MCP_DIR          = PLUGIN_ROOT / "mcp_servers"


def _fail(msg: str) -> None:
    print(f"\n[fieldpulse] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def _info(msg: str) -> None:
    print(f"[fieldpulse] {msg}")


def _ok(msg: str) -> None:
    print(f"[fieldpulse] ✓ {msg}")


def _warn(msg: str) -> None:
    print(f"[fieldpulse] ⚠ {msg}")


def check_python() -> None:
    if sys.version_info < MIN_PYTHON:
        _fail(
            f"Python {'.'.join(map(str, MIN_PYTHON))}+ is required. "
            f"Current: {sys.version.split()[0]}\n"
            "  Download: https://python.org/downloads"
        )
    _ok(f"Python {sys.version.split()[0]}")


def get_venv_python() -> str:
    if platform.system() == "Windows":
        return str(VENV_DIR / "Scripts" / "python.exe")
    return str(VENV_DIR / "bin" / "python")


def get_venv_pip() -> str:
    if platform.system() == "Windows":
        return str(VENV_DIR / "Scripts" / "pip.exe")
    return str(VENV_DIR / "bin" / "pip")


def create_venv() -> None:
    if VENV_DIR.exists():
        _ok(f"Virtual environment already exists at {VENV_DIR}")
        return
    _info(f"Creating virtual environment at {VENV_DIR} ...")
    subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
    _ok("Virtual environment created")


def install_deps() -> None:
    lock_file = MCP_DIR / "requirements.lock.txt"
    req_file  = MCP_DIR / "requirements.txt"

    pip = get_venv_pip()

    # Upgrade pip first (silently)
    subprocess.run([pip, "install", "--quiet", "--upgrade", "pip"], check=True)

    if lock_file.exists():
        _info("Installing from requirements.lock.txt (hash-verified) ...")
        subprocess.run(
            [pip, "install", "--quiet", "--require-hashes", "-r", str(lock_file)],
            check=True,
        )
        _ok("Dependencies installed from lockfile")
    else:
        _warn(
            "requirements.lock.txt not found — installing from requirements.txt "
            "(not hash-verified). Run `pip-compile --generate-hashes` to create the lockfile."
        )
        subprocess.run(
            [pip, "install", "--quiet", "-r", str(req_file)],
            check=True,
        )
        _ok("Dependencies installed from requirements.txt")


def create_dirs() -> None:
    for subdir in ["cache", "logs"]:
        d = FIELDPULSE_HOME / subdir
        d.mkdir(parents=True, exist_ok=True)
        if platform.system() != "Windows":
            os.chmod(str(d), 0o700)

    if platform.system() != "Windows":
        try:
            os.chmod(str(FIELDPULSE_HOME), 0o700)
        except OSError:
            pass

    _ok(f"Data directories ready at {FIELDPULSE_HOME}")


def check_claude_code() -> None:
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True, text=True, timeout=5,
        )
        version_str = result.stdout.strip() or result.stderr.strip()
        _ok(f"Claude Code: {version_str}")
    except FileNotFoundError:
        _warn("Claude Code not found in PATH. Install: https://claude.ai/code")
    except subprocess.TimeoutExpired:
        _warn("Claude Code check timed out")


def smoke_test_imports() -> None:
    python = get_venv_python()
    _info("Running MCP server import smoke tests ...")
    servers = ["satellite_mcp", "soil_mcp", "weather_mcp"]
    for server in servers:
        result = subprocess.run(
            [python, "-c", f"import sys; sys.path.insert(0, '{MCP_DIR}'); import {server}"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            _ok(f"{server} imports successfully")
        else:
            _warn(f"{server} import failed:\n{result.stderr.strip()[:300]}")


def print_mcp_config_hint() -> None:
    python = get_venv_python()
    print()
    _info("MCP server registration:")
    print(f"""
  The .mcp.json file in this directory uses:
    "command": "{python}"

  If Claude Code doesn't auto-detect .mcp.json, register manually:
    claude mcp add fieldpulse-satellite -- {python} {MCP_DIR}/satellite_mcp.py
    claude mcp add fieldpulse-soil      -- {python} {MCP_DIR}/soil_mcp.py
    claude mcp add fieldpulse-weather   -- {python} {MCP_DIR}/weather_mcp.py
""")


def main() -> None:
    print("FieldPulse — Real-time vitals for your land")
    print("=" * 45)
    check_python()
    create_venv()
    install_deps()
    create_dirs()
    check_claude_code()
    smoke_test_imports()
    print_mcp_config_hint()
    print("[fieldpulse] Setup complete!\n")
    print("  Try: /fieldpulse:analyze \"Iowa corn belt\" --crop maize")
    print()


if __name__ == "__main__":
    main()
