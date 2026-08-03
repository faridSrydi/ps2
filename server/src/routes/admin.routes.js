// ============================================================
// PS2 Cloud Gaming Platform — Admin Routes
// ============================================================

import { Router } from 'express';
import {
  getDashboard,
  listUsers,
  changeUserRole,
  deleteUser,
  listSessions,
  forceKillSession,
  getMonitoring,
  getLogs,
} from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/users', listUsers);
router.put('/users/:id/role', changeUserRole);
router.delete('/users/:id', deleteUser);
router.get('/sessions', listSessions);
router.delete('/sessions/:id', forceKillSession);
router.get('/monitoring', getMonitoring);
router.get('/logs', getLogs);

export default router;
