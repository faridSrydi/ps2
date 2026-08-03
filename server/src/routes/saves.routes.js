// ============================================================
// PS2 Cloud Gaming Platform — Saves Routes
// ============================================================

import { Router } from 'express';
import { listSaves, deleteSave } from '../controllers/saves.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/:gameId', listSaves);
router.delete('/:id', deleteSave);

export default router;
