#!/bin/bash
# ============================================================
# PS2 Cloud Gaming Platform — Deployment Script
# Builds frontend via Docker Node 22, runs containers via Compose
# Usage: bash scripts/deploy.sh
# ============================================================

set -e

echo "[deploy] Building React frontend via Docker (Node 22)..."
docker run --rm -v "$(pwd)/client:/app" -w /app node:22-alpine sh -c "npm install && npm run build"

echo "[deploy] Starting Docker Compose services in Host Network mode..."
docker compose down --remove-orphans
docker compose up -d --build

echo "[deploy] Service status:"
docker compose ps

echo ""
echo "✓ PS2 Cloud Gaming Platform deployed successfully!"
echo "Access website at: http://localhost or http://YOUR_VPS_IP"
