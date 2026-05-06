"""
pytest configuration for FieldPulse tests.

Adds mcp_servers/ to sys.path and redirects cache to a temp directory
for all tests that import cache-using modules.
"""

import sys
from pathlib import Path

# Make mcp_servers importable in all tests
sys.path.insert(0, str(Path(__file__).parent.parent / "mcp_servers"))
