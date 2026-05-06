#!/usr/bin/env bash
# FieldPulse setup script
# Run once after cloning: bash scripts/setup.sh

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

info()    { echo -e "${BOLD}[fieldpulse]${RESET} $*"; }
success() { echo -e "${GREEN}[fieldpulse] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[fieldpulse] ⚠${RESET} $*"; }
error()   { echo -e "${RED}[fieldpulse] ✗${RESET} $*"; exit 1; }

info "FieldPulse setup starting..."

# ── Python check ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    error "Python 3.9+ is required. Install it from https://www.python.org"
fi

PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")

if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 9 ]); then
    error "Python 3.9+ required. Found ${PY_VERSION}."
fi
success "Python ${PY_VERSION} found"

# ── pip / venv ────────────────────────────────────────────────────────────────
VENV_DIR=".venv"

if [ ! -d "$VENV_DIR" ]; then
    info "Creating virtual environment at ${VENV_DIR}..."
    python3 -m venv "$VENV_DIR"
    success "Virtual environment created"
else
    success "Virtual environment already exists"
fi

# activate
source "${VENV_DIR}/bin/activate"

# upgrade pip silently
pip install --upgrade pip --quiet

# ── install dependencies ──────────────────────────────────────────────────────
info "Installing MCP server dependencies..."
pip install -r mcp_servers/requirements.txt --quiet

# verify critical imports
python3 -c "import mcp; import httpx; import pystac_client; import planetary_computer; import rasterio; import numpy" 2>/dev/null \
    && success "All Python dependencies installed successfully" \
    || warn "Some packages may have had install warnings — check above output"

# ── GDAL / rasterio check ─────────────────────────────────────────────────────
python3 -c "import rasterio; print(rasterio.__version__)" &>/dev/null \
    && success "rasterio $(python3 -c 'import rasterio; print(rasterio.__version__)') ready" \
    || warn "rasterio install may have issues. On macOS: brew install gdal then pip install rasterio"

# ── smoke test each MCP server ────────────────────────────────────────────────
info "Running MCP server smoke tests..."

for server in satellite_mcp soil_mcp weather_mcp; do
    # send MCP initialize message and expect a response
    response=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
        | timeout 10 python3 "mcp_servers/${server}.py" 2>/dev/null | head -1)
    if echo "$response" | grep -q '"result"'; then
        success "${server}.py initialises correctly"
    else
        warn "${server}.py did not respond as expected — check dependencies"
    fi
done

# ── create cache directory ────────────────────────────────────────────────────
mkdir -p .fieldpulse_cache
if ! grep -q ".fieldpulse_cache" .gitignore 2>/dev/null; then
    echo ".fieldpulse_cache/" >> .gitignore
    echo ".venv/"               >> .gitignore
    success "Added .fieldpulse_cache/ and .venv/ to .gitignore"
fi

# ── optional Copernicus token ─────────────────────────────────────────────────
echo ""
info "Optional: Copernicus Data Space Ecosystem token"
echo "  FieldPulse works without it (falls back to Microsoft Planetary Computer)"
echo "  To enable Sentinel-2 direct download: register at https://dataspace.copernicus.eu"
echo "  Then set: export COPERNICUS_TOKEN=<your_token>"
echo ""

# ── MCP server registration hint ─────────────────────────────────────────────
info "Next step: register MCP servers with Claude Code"
echo ""
echo "  Option A — Project scope (recommended):"
echo "    The .mcp.json file in this directory is auto-detected by Claude Code."
echo "    Just open Claude Code in this directory."
echo ""
echo "  Option B — Global scope:"
echo "    claude mcp add fieldpulse-satellite -- python $(pwd)/mcp_servers/satellite_mcp.py"
echo "    claude mcp add fieldpulse-soil      -- python $(pwd)/mcp_servers/soil_mcp.py"
echo "    claude mcp add fieldpulse-weather   -- python $(pwd)/mcp_servers/weather_mcp.py"
echo ""

success "FieldPulse setup complete!"
echo ""
echo "  Try it: /fieldpulse:analyze --location \"Punjab, India\" --crop wheat"
echo ""
