#!/bin/bash
# ============================================================
# PS2 Cloud Gaming Platform — Container Entrypoint
# Sets up virtual display, audio, then starts the server
# ============================================================

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   PS2 Cloud Gaming Platform — Starting...     ║"
echo "╚════════════════════════════════════════════════╝"

# ─── Start PulseAudio (virtual audio) ─────────────────────
echo "[entrypoint] Starting PulseAudio..."
pulseaudio --start --exit-idle-time=-1 2>/dev/null || true

# ─── Run Prisma Migrations ────────────────────────────────
echo "[entrypoint] Running database migrations..."
cd /app/server
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
cd /app

# ─── Seed Admin User (first run) ──────────────────────────
echo "[entrypoint] Checking admin user..."
cd /app/server
node -e "
  import('./src/utils/seedAdmin.js')
    .then(m => m.default())
    .catch(() => console.log('[seed] Admin already exists or seed skipped'))
" 2>/dev/null || true
cd /app

# ─── Check NVIDIA GPU ─────────────────────────────────────
echo "[entrypoint] Checking GPU..."
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
    echo "[entrypoint] ✓ NVIDIA GPU detected"
else
    echo "[entrypoint] ⚠ No NVIDIA GPU detected — streaming will use software encoding"
fi

# ─── Check PCSX2 ──────────────────────────────────────────
echo "[entrypoint] Checking PCSX2..."
if command -v pcsx2-qt &> /dev/null; then
    echo "[entrypoint] ✓ PCSX2 found"
else
    echo "[entrypoint] ⚠ PCSX2 not found — emulator features will be unavailable"
fi

# ─── Check BIOS ───────────────────────────────────────────
if [ -d "/app/bios" ] && [ "$(ls -A /app/bios 2>/dev/null)" ]; then
    echo "[entrypoint] ✓ BIOS files found in /app/bios"
else
    echo "[entrypoint] ⚠ No BIOS files found — place PS2 BIOS in /app/bios"
fi

# ─── Check Games ──────────────────────────────────────────
GAME_COUNT=$(find /app/games -type f \( -name "*.iso" -o -name "*.bin" -o -name "*.chd" -o -name "*.gz" -o -name "*.cue" \) 2>/dev/null | wc -l)
echo "[entrypoint] Found ${GAME_COUNT} game file(s) in /app/games"

echo ""
echo "[entrypoint] ✓ All checks complete. Starting server..."
echo ""

# ─── Execute CMD ──────────────────────────────────────────
exec "$@"
