// ============================================================
// PS2 Cloud Gaming Platform — Admin Controller
// Dashboard stats, user management, session control, monitoring
// ============================================================

import prisma from '../config/database.js';
import { getSystemStats } from '../services/monitoring.service.js';
import logger from '../utils/logger.js';

/**
 * GET /api/admin/dashboard
 * Get dashboard overview stats
 */
export async function getDashboard(req, res) {
  try {
    const [
      totalUsers,
      totalGames,
      activeSessions,
      totalSessions,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.game.count(),
      prisma.session.count({ where: { status: { in: ['RUNNING', 'PAUSED', 'CREATING'] } } }),
      prisma.session.count(),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, username: true, role: true, createdAt: true },
      }),
    ]);

    // Get total play time across all users
    const totalPlayTime = await prisma.recentlyPlayed.aggregate({
      _sum: { playDurationSecs: true },
    });

    // Get top played games
    const topGames = await prisma.game.findMany({
      take: 5,
      orderBy: { playCount: 'desc' },
      select: { id: true, title: true, coverPath: true, playCount: true },
    });

    // Get system stats
    const systemStats = await getSystemStats();

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalGames,
          activeSessions,
          totalSessions,
          totalPlayTimeHours: Math.round((totalPlayTime._sum.playDurationSecs || 0) / 3600),
        },
        recentUsers,
        topGames,
        system: systemStats,
      },
    });
  } catch (error) {
    logger.error('[admin] Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/users
 * List all users with pagination
 */
export async function listUsers(req, res) {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          _count: { select: { sessions: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error) {
    logger.error('[admin] List users error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * PUT /api/admin/users/:id/role
 * Change a user's role
 */
export async function changeUserRole(req, res) {
  try {
    const { role } = req.body;
    const validRoles = ['ADMIN', 'USER', 'GUEST'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, username: true, role: true },
    });

    logger.info(`[admin] Role changed: ${user.username} → ${role}`);

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('[admin] Change role error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * DELETE /api/admin/users/:id
 * Delete a user account
 */
export async function deleteUser(req, res) {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });

    logger.info(`[admin] User deleted: ${req.params.id}`);

    res.json({ success: true, message: 'User deleted.' });
  } catch (error) {
    logger.error('[admin] Delete user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/sessions
 * List all active sessions
 */
export async function listSessions(req, res) {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, username: true } },
        game: { select: { id: true, title: true } },
        _count: { select: { controllerPairs: true } },
      },
    });

    res.json({ success: true, data: sessions });
  } catch (error) {
    logger.error('[admin] List sessions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * DELETE /api/admin/sessions/:id
 * Force kill a session
 */
export async function forceKillSession(req, res) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    // Kill PCSX2 process if running
    if (session.pcsx2Pid) {
      try {
        process.kill(session.pcsx2Pid, 'SIGKILL');
      } catch {
        // Process may already be dead
      }
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'STOPPED', endedAt: new Date() },
    });

    logger.warn(`[admin] Force killed session: ${session.roomId}`);

    res.json({ success: true, message: 'Session force killed.' });
  } catch (error) {
    logger.error('[admin] Force kill error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/monitoring
 * Get real-time system monitoring stats
 */
export async function getMonitoring(req, res) {
  try {
    const stats = await getSystemStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[admin] Monitoring error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/logs
 * Get recent system logs
 */
export async function getLogs(req, res) {
  try {
    const { level, limit = 50, page = 1 } = req.query;
    const where = {};
    if (level) where.level = level;

    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('[admin] Logs error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

export default {
  getDashboard,
  listUsers,
  changeUserRole,
  deleteUser,
  listSessions,
  forceKillSession,
  getMonitoring,
  getLogs,
};
