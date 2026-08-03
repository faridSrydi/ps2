// ============================================================
// PS2 Cloud Gaming Platform — Environment Configuration
// Centralizes all env vars with defaults
// ============================================================

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const config = {
  // ─── Server ─────────────────────────────────────────────
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',

  // ─── Database ───────────────────────────────────────────
  databaseUrl: process.env.DATABASE_URL,

  // ─── JWT ────────────────────────────────────────────────
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // ─── CORS ───────────────────────────────────────────────
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // ─── File Paths ─────────────────────────────────────────
  paths: {
    games: process.env.GAMES_DIR || resolve(__dirname, '../../../games'),
    bios: process.env.BIOS_DIR || resolve(__dirname, '../../../bios'),
    saves: process.env.SAVES_DIR || resolve(__dirname, '../../../saves'),
    covers: process.env.COVERS_DIR || resolve(__dirname, '../../../covers'),
    screenshots: process.env.SCREENSHOTS_DIR || resolve(__dirname, '../../../screenshots'),
    config: process.env.CONFIG_DIR || resolve(__dirname, '../../../config'),
    logs: process.env.LOGS_DIR || resolve(__dirname, '../../../logs'),
    storage: process.env.STORAGE_DIR || resolve(__dirname, '../../../storage'),
  },

  // ─── PCSX2 ──────────────────────────────────────────────
  pcsx2: {
    binary: process.env.PCSX2_BINARY || 'pcsx2-qt',
    configDir: process.env.PCSX2_CONFIG_DIR || '/app/config/pcsx2',
    biosPath: process.env.BIOS_PATH || resolve(__dirname, '../../../bios'),
  },

  // ─── Streaming ──────────────────────────────────────────
  streaming: {
    portMin: parseInt(process.env.WEBRTC_PORT_MIN, 10) || 10000,
    portMax: parseInt(process.env.WEBRTC_PORT_MAX, 10) || 10100,
    stunServer: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302',
    resolution: process.env.STREAM_RESOLUTION || '1280x720',
    bitrate: parseInt(process.env.STREAM_BITRATE, 10) || 4000,
    fps: parseInt(process.env.STREAM_FPS, 10) || 60,
  },

  // ─── Session ────────────────────────────────────────────
  session: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS, 10) || 8,
    timeoutHours: parseInt(process.env.SESSION_TIMEOUT_HOURS, 10) || 4,
    idleTimeoutMinutes: parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES, 10) || 30,
  },

  // ─── Rate Limiting ─────────────────────────────────────
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // ─── Admin ──────────────────────────────────────────────
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    email: process.env.ADMIN_EMAIL || 'admin@ps2cloud.local',
  },
};

export default config;
