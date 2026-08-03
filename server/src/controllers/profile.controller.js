// ============================================================
// PS2 Cloud Gaming Platform — Profile Controller
// Manage user profile and avatar
// ============================================================

import prisma from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * GET /api/profile
 * Get current user's profile with stats
 */
export async function getProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            favorites: true,
            saveStates: true,
            screenshots: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Get total play time
    const playTime = await prisma.recentlyPlayed.aggregate({
      where: { userId: req.user.id },
      _sum: { playDurationSecs: true },
    });

    res.json({
      success: true,
      data: {
        ...user,
        stats: {
          favorites: user._count.favorites,
          saves: user._count.saveStates,
          screenshots: user._count.screenshots,
          sessions: user._count.sessions,
          totalPlayTimeSeconds: playTime._sum.playDurationSecs || 0,
        },
      },
    });
  } catch (error) {
    logger.error('[profile] Get error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * PUT /api/profile
 * Update user profile info
 */
export async function updateProfile(req, res) {
  try {
    const { username, email } = req.body;
    const data = {};

    if (username) {
      // Check username uniqueness
      const existing = await prisma.user.findFirst({
        where: { username, id: { not: req.user.id } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Username already taken.' });
      }
      data.username = username;
    }

    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: req.user.id } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      }
      data.email = email;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No changes provided.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, username: true, email: true, role: true, avatarUrl: true },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('[profile] Update error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * PUT /api/profile/avatar
 * Upload user avatar (handled by multer middleware)
 */
export async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const avatarUrl = `/storage/avatars/${req.file.filename}`;

    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
    });

    res.json({
      success: true,
      data: { avatarUrl },
    });
  } catch (error) {
    logger.error('[profile] Avatar upload error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

export default { getProfile, updateProfile, uploadAvatar };
