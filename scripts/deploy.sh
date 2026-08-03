#!/bin/bash
# ============================================================
# PS2 Cloud Gaming Platform — Deployment Script
# Builds frontend, runs containers via Docker Compose
# Usage: bash scripts/deploy.sh
# ============================================================

set -e

echo "[deploy] Building frontend..."
cd client
npm install
npm run build
cd ..

echo "[deploy] Starting Docker Compose services..."
docker compose down
docker compose up -d --build

echo "[deploy] Service status:"
docker compose ps

echo ""
echo "✓ PS2 Cloud Gaming Platform deployed successfully!"
echo "Access website at: http://localhost"
