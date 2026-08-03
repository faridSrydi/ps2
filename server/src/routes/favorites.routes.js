// ============================================================
// PS2 Cloud Gaming Platform — Favorites Routes
// ============================================================

import { Router } from 'express';
import { listFavorites, addFavorite, removeFavorite } from '../controllers/favorites.controller.js';
import { authenticate } from '../middleware/auth.js';
import { favoriteRules, validate } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.get('/', listFavorites);
router.post('/', favoriteRules, validate, addFavorite);
router.delete('/:gameId', removeFavorite);

export default router;
