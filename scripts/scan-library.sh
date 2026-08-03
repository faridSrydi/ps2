#!/bin/bash
# ============================================================
# PS2 Cloud Gaming Platform — Library Rescan CLI Tool
# Triggers library rescan via curl
# Usage: bash scripts/scan-library.sh
# ============================================================

API_URL="http://localhost:3000/api/games/rescan"

echo "Triggering library rescan at ${API_URL}..."
curl -X POST "${API_URL}" -H "Content-Type: application/json"
echo ""
