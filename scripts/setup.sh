#!/bin/bash
# ============================================================
# PS2 Cloud Gaming Platform — Server Setup Script
# Run on clean Ubuntu 24.04 LTS server with NVIDIA L4 GPU
# Usage: sudo bash scripts/setup.sh
# ============================================================

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   PS2 Cloud Gaming — Server Environment Setup  ║"
echo "╚════════════════════════════════════════════════╝"

# 1. Update system packages
echo "[1/5] Updating OS packages..."
apt update && apt upgrade -y

# 2. Install Docker & Docker Compose
echo "[2/5] Installing Docker & Docker Compose..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

# 3. Install NVIDIA Container Toolkit
echo "[3/5] Setting up NVIDIA Container Toolkit..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/experimental/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

apt update
apt install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

# 4. Create local folder structure
echo "[4/5] Creating folder structure..."
mkdir -p games/ps2 bios saves covers screenshots config logs storage

# 5. Summary
echo ""
echo "================================================="
echo "✓ Server setup complete!"
echo "Put your PS2 BIOS files in ./bios/"
echo "Put your PS2 ISO games in ./games/ps2/"
echo "Then run: bash scripts/deploy.sh"
echo "================================================="
