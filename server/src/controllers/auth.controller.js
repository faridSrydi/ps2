// ============================================================
// PS2 Cloud Gaming Platform — Auth Controller
// Handles registration, login, guest access, token refresh
// ============================================================

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { generateTokens, verifyRefreshToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

/**
 * POST /api/auth/register
 * Create a new user account
 */
export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    // Check if username or email already taken
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.username === username
          ? 'Username already taken.'
          : 'Email already registered.',
      });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, email, passwordHash, role: 'USER' },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });

    const tokens = generateTokens(user);
    logger.info(`[auth] User registered: ${username}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: { user, ...tokens },
    });
  } catch (error) {
    logger.error('[auth] Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/auth/login
 * Authenticate with username and password
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = generateTokens(user);
    logger.info(`[auth] User logged in: ${username}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        ...tokens,
      },
    });
  } catch (error) {
    logger.error('[auth] Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/auth/guest
 * Create a temporary guest account
 */
export async function guestLogin(req, res) {
  try {
    const guestId = uuidv4().split('-')[0];
    const username = `guest_${guestId}`;

    const user = await prisma.user.create({
      data: { username, role: 'GUEST' },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    const tokens = generateTokens(user);
    logger.info(`[auth] Guest login: ${username}`);

    res.status(201).json({
      success: true,
      data: { user, ...tokens },
    });
  } catch (error) {
    logger.error('[auth] Guest login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/auth/refresh
 * Refresh an expired access token
 */
export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    const tokens = generateTokens(user);

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    logger.error('[auth] Token refresh error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
export async function getMe(req, res) {
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
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('[auth] Get me error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

export default { register, login, guestLogin, refreshToken, getMe };
