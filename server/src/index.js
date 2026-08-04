// ============================================================
// PS2 Cloud Gaming Platform — Server Entry Point
// Express + Socket.io + Prisma
// ============================================================

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import config from './config/env.js';
import prisma from './config/database.js';
import logger from './utils/logger.js';
import { initializeSocket } from './socket/index.js';
import { scanLibrary } from './services/library.service.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import gamesRoutes from './routes/games.routes.js';
import sessionRoutes from './routes/session.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import savesRoutes from './routes/saves.routes.js';
import profileRoutes from './routes/profile.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Create Express App ──────────────────────────────────
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// ─── Initialize Socket.io ────────────────────────────────
const io = initializeSocket(server);

// ─── Middleware ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for streaming
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(apiLimiter);

// HTTP request logging
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── Static Files ────────────────────────────────────────
app.use('/covers', express.static(config.paths.covers, { maxAge: '7d' }));
app.use('/screenshots', express.static(config.paths.screenshots, { maxAge: '1d' }));
app.use('/storage', express.static(config.paths.storage));

// ─── API Routes ──────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/saves', savesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

// Recently played endpoint
app.get('/api/recent', async (req, res) => {
  try {
    // Get token from header if present
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Auth required.' });
    }

    const jwt = await import('jsonwebtoken');
    const token = authHeader.split(' ')[1];
    const user = jwt.default.verify(token, config.jwt.secret);

    const recent = await prisma.recentlyPlayed.findMany({
      where: { userId: user.id },
      orderBy: { playedAt: 'desc' },
      take: 20,
      include: {
        game: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverPath: true,
            genre: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: recent.map((r) => ({
        ...r.game,
        playedAt: r.playedAt,
        playDuration: r.playDurationSecs,
      })),
    });
  } catch (error) {
    logger.error('[recent] Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Screenshots endpoint
app.get('/api/screenshots', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Auth required.' });
    }

    const jwt = await import('jsonwebtoken');
    const token = authHeader.split(' ')[1];
    const user = jwt.default.verify(token, config.jwt.secret);

    const screenshots = await prisma.screenshot.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        game: { select: { title: true } },
      },
    });

    res.json({ success: true, data: screenshots });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: config.env,
  });
});

// ─── 404 Handler ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// ─── Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: config.env === 'development' ? err.message : 'Internal server error.',
  });
});

// ─── Ensure Data Directories ─────────────────────────────
async function ensureDirectories() {
  const dirs = Object.values(config.paths);
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  // Also create avatars subdirectory
  await fs.mkdir(resolve(config.paths.storage, 'avatars'), { recursive: true });
}

// ─── Startup ─────────────────────────────────────────────
async function start() {
  try {
    // Ensure directories exist
    await ensureDirectories();
    logger.info('[server] ✓ Data directories ready');

    // Test database connection
    await prisma.$connect();
    logger.info('[server] ✓ Database connected');

    // Scan game library on startup
    try {
      const scanResult = await scanLibrary();
      logger.info(`[server] ✓ Library scanned: ${scanResult.total} games`);
    } catch (err) {
      logger.warn(`[server] Library scan skipped: ${err.message}`);
    }

    // Start server
    server.listen(config.port, config.host, () => {
      logger.info('');
      logger.info('╔════════════════════════════════════════════════╗');
      logger.info('║   PS2 Cloud Gaming Platform                   ║');
      logger.info(`║   Server running on ${config.host}:${config.port}             ║`);
      logger.info(`║   Environment: ${config.env.padEnd(30)}║`);
      logger.info('╚════════════════════════════════════════════════╝');
      logger.info('');
    });
  } catch (error) {
    logger.error('[server] Failed to start:', error);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────
async function shutdown(signal) {
  logger.info(`[server] Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    await prisma.$disconnect();
    logger.info('[server] ✓ Shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('[server] Force shutdown (timeout)');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Start the server ────────────────────────────────────
start();

export { app, server, io };
