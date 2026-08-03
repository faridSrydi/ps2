// ============================================================
// PS2 Cloud Gaming Platform — Prisma Database Client
// Singleton pattern to prevent multiple connections
// ============================================================

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

let prisma;

/**
 * Get or create a Prisma client singleton.
 * In development, the client is stored on `globalThis` to survive
 * hot-reloads without creating new connections.
 */
function getClient() {
  if (prisma) return prisma;

  prisma = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  // Log errors and warnings through our logger
  prisma.$on('error', (e) => {
    logger.error(`[prisma] ${e.message}`, { target: e.target });
  });

  prisma.$on('warn', (e) => {
    logger.warn(`[prisma] ${e.message}`, { target: e.target });
  });

  // Store on globalThis in development to survive hot-reloads
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prisma;
  }

  return prisma;
}

// Reuse existing client in development
if (process.env.NODE_ENV !== 'production' && globalThis.__prisma) {
  prisma = globalThis.__prisma;
} else {
  prisma = getClient();
}

export default prisma;
