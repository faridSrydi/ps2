// ============================================================
// PS2 Cloud Gaming Platform — Auth Routes
// ============================================================

import { Router } from 'express';
import { register, login, guestLogin, refreshToken, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerRules, loginRules, validate } from '../middleware/validation.js';

const router = Router();

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/guest', authLimiter, guestLogin);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getMe);

export default router;
