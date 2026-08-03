# ============================================================
# PS2 Cloud Gaming Platform — Dockerfile
# Base: Ubuntu 24.04 + Node.js + PCSX2 + GStreamer + NVIDIA
# ============================================================

FROM nvidia/cuda:12.6.3-runtime-ubuntu24.04

LABEL maintainer="PS2 Cloud Gaming"
LABEL description="PS2 Cloud Gaming Platform Server"

# ─── Environment ───────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,video,graphics,utility

# ─── System Dependencies ──────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools
    curl \
    wget \
    gnupg2 \
    software-properties-common \
    ca-certificates \
    # Virtual display
    xvfb \
    x11-utils \
    # Audio
    pulseaudio \
    # GStreamer (streaming pipeline)
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-nice \
    gstreamer1.0-libav \
    libgstreamer1.0-dev \
    # NVIDIA GStreamer plugins (NVENC)
    gstreamer1.0-vaapi \
    # Vulkan support for PCSX2
    mesa-vulkan-drivers \
    vulkan-tools \
    libvulkan1 \
    # Virtual gamepad
    libevdev-dev \
    # Misc
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# ─── Node.js 22 LTS ───────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ─── PCSX2 ────────────────────────────────────────────────
# Install PCSX2 via official v2.x AppImage (extracted to bypass FUSE requirements in Docker)
RUN curl -L -o /tmp/pcsx2.AppImage "https://github.com/PCSX2/pcsx2/releases/download/v2.2.0/pcsx2-v2.2.0-linux-appimage-x64.AppImage" \
    && chmod +x /tmp/pcsx2.AppImage \
    && cd /tmp && ./pcsx2.AppImage --appimage-extract \
    && mv /tmp/squashfs-root /opt/pcsx2 \
    && ln -s /opt/pcsx2/AppRun /usr/bin/pcsx2-qt \
    && rm -f /tmp/pcsx2.AppImage \
    || (apt-get update && apt-get install -y pcsx2 && rm -rf /var/lib/apt/lists/*)

# ─── Working Directory ────────────────────────────────────
WORKDIR /app

# ─── Install Server Dependencies ──────────────────────────
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev

# ─── Copy Prisma Schema & Generate Client ─────────────────
COPY server/prisma ./server/prisma/
RUN cd server && npx prisma generate

# ─── Copy Server Source ───────────────────────────────────
COPY server/src ./server/src/

# ─── Copy Controller Files ────────────────────────────────
COPY controller ./controller/

# ─── Create Data Directories ──────────────────────────────
RUN mkdir -p /app/games /app/bios /app/saves /app/covers \
    /app/screenshots /app/config /app/logs /app/storage

# ─── Startup Script ───────────────────────────────────────
COPY scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
EXPOSE 10000-10100/udp

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server/src/index.js"]
