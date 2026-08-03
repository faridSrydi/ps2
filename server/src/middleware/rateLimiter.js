// ============================================================
// PS2 Cloud Gaming Platform — Rate Limiter Middleware
// Prevents abuse by limiting request frequency
// ============================================================

import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

/**
 * General API rate limiter
 * Default: 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,   // Disable `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for auth endpoints
 * 10 attempts per 15 minutes (prevents brute force)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'AUTH_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Session creation limiter
 * Max 5 sessions per 10 minutes per IP
 */
export const sessionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    success: false,
    message: 'Too many session requests. Please wait before starting a new game.',
    code: 'SESSION_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default { apiLimiter, authLimiter, sessionLimiter };
