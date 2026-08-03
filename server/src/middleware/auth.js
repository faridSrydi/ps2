// ============================================================
// PS2 Cloud Gaming Platform — JWT Auth Middleware
// Verifies JWT tokens and attaches user to request
// ============================================================

import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import prisma from '../config/database.js';

/**
 * Middleware: Require valid JWT token.
 * Attaches `req.user` with user data from DB.
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh.',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
}

/**
 * Middleware: Optional authentication.
 * If token is present, attach user. If not, continue without user.
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      req.user = jwt.verify(token, config.jwt.secret);
    }
  } catch {
    // Token invalid — continue as unauthenticated
  }
  next();
}

/**
 * Middleware: Require specific role(s).
 * Must be used after `authenticate`.
 *
 * @param {...string} roles - Allowed roles (e.g., 'ADMIN', 'USER')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.',
      });
    }

    next();
  };
}

/**
 * Generate JWT access and refresh tokens for a user.
 * @param {object} user - User object from DB
 * @returns {{ accessToken: string, refreshToken: string }}
 */
export function generateTokens(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(
    { id: user.id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify a refresh token.
 * @param {string} token - Refresh token
 * @returns {object|null} Decoded token or null
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch {
    return null;
  }
}

export default { authenticate, optionalAuth, authorize, generateTokens, verifyRefreshToken };
