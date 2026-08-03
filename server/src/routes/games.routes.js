// ============================================================
// PS2 Cloud Gaming Platform — Games Routes
// ============================================================

import { Router } from 'express';
import { listGames, getGame, searchGames, rescanLibrary } from '../controllers/games.controller.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { searchGamesRules, uuidParam, validate } from '../middleware/validation.js';

const router = Router();

router.get('/', optionalAuth, searchGamesRules, validate, listGames);
router.get('/search', searchGamesRules, validate, searchGames);
router.post('/rescan', authenticate, authorize('ADMIN'), rescanLibrary);
router.get('/:id', optionalAuth, uuidParam, validate, getGame);

export default router;
