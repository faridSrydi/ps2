// ============================================================
// PS2 Cloud Gaming Platform — Input Validation Middleware
// Uses express-validator for request validation
// ============================================================

import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware: Check validation results and return 400 if invalid
 */
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

// ─── Auth Validators ──────────────────────────────────────

export const registerRules = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

export const loginRules = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// ─── Session Validators ───────────────────────────────────

export const createSessionRules = [
  body('gameId')
    .isUUID()
    .withMessage('Invalid game ID'),
];

export const pairControllerRules = [
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('Device ID is required'),
  body('playerNumber')
    .optional()
    .isInt({ min: 1, max: 2 })
    .withMessage('Player number must be 1 or 2'),
];

// ─── Game Validators ──────────────────────────────────────

export const searchGamesRules = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be 1-100 characters'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be 1-50'),
];

// ─── Favorite Validators ─────────────────────────────────

export const favoriteRules = [
  body('gameId')
    .isUUID()
    .withMessage('Invalid game ID'),
];

// ─── Save State Validators ───────────────────────────────

export const saveStateRules = [
  body('gameId')
    .isUUID()
    .withMessage('Invalid game ID'),
  body('slot')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Slot must be 1-10'),
];

// ─── Profile Validators ──────────────────────────────────

export const updateProfileRules = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
];

// ─── UUID Param Validator ─────────────────────────────────

export const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID parameter'),
];

export default {
  validate,
  registerRules,
  loginRules,
  createSessionRules,
  pairControllerRules,
  searchGamesRules,
  favoriteRules,
  saveStateRules,
  updateProfileRules,
  uuidParam,
};
