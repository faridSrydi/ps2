// ============================================================
// PS2 Cloud Gaming Platform — Admin Seeder
// Creates default admin user on first startup
// ============================================================

import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import config from '../config/env.js';
import logger from './logger.js';

/**
 * Seed the default admin user if it doesn't exist.
 * Called by the container entrypoint on first startup.
 */
export default async function seedAdmin() {
  try {
    const existing = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existing) {
      logger.info(`[seed] Admin user already exists: ${existing.username}`);
      return;
    }

    const passwordHash = await bcrypt.hash(config.admin.password, 12);

    const admin = await prisma.user.create({
      data: {
        username: config.admin.username,
        email: config.admin.email,
        passwordHash,
        role: 'ADMIN',
      },
    });

    logger.info(`[seed] ✓ Admin user created: ${admin.username} (${admin.email})`);
  } catch (error) {
    logger.error('[seed] Failed to create admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}
