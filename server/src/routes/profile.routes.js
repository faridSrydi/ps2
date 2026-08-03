// ============================================================
// PS2 Cloud Gaming Platform — Profile Routes
// ============================================================

import { Router } from 'express';
import multer from 'multer';
import { getProfile, updateProfile, uploadAvatar } from '../controllers/profile.controller.js';
import { authenticate } from '../middleware/auth.js';
import { updateProfileRules, validate } from '../middleware/validation.js';
import config from '../config/env.js';

const router = Router();

// Avatar upload config
const avatarStorage = multer.diskStorage({
  destination: `${config.paths.storage}/avatars`,
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${req.user.id}.${ext}`);
  },
});

const uploadMiddleware = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(authenticate);

router.get('/', getProfile);
router.put('/', updateProfileRules, validate, updateProfile);
router.put('/avatar', uploadMiddleware.single('avatar'), uploadAvatar);

export default router;
