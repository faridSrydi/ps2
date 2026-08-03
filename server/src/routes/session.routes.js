// ============================================================
// PS2 Cloud Gaming Platform — Session Routes
// ============================================================

import { Router } from 'express';
import {
  createSession,
  getSession,
  pauseSession,
  resumeSession,
  destroySession,
  captureScreenshot,
  saveState,
} from '../controllers/session.controller.js';
import { authenticate } from '../middleware/auth.js';
import { sessionLimiter } from '../middleware/rateLimiter.js';
import { createSessionRules, uuidParam, validate } from '../middleware/validation.js';

const router = Router();

// All session routes require authentication
router.use(authenticate);

router.post('/', sessionLimiter, createSessionRules, validate, createSession);
router.get('/:id', uuidParam, validate, getSession);
router.post('/:id/pause', uuidParam, validate, pauseSession);
router.post('/:id/resume', uuidParam, validate, resumeSession);
router.post('/:id/screenshot', uuidParam, validate, captureScreenshot);
router.post('/:id/save', uuidParam, validate, saveState);
router.delete('/:id', uuidParam, validate, destroySession);

export default router;
