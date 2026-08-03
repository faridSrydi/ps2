// ============================================================
// PS2 Cloud Gaming Platform — Saves Controller
// Manage save states per user per game
// ============================================================

import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

/**
 * GET /api/saves/:gameId
 * List save states for a specific game
 */
export async function listSaves(req, res) {
  try {
    const saves = await prisma.saveState.findMany({
      where: {
        userId: req.user.id,
        gameId: req.params.gameId,
      },
      orderBy: { slot: 'asc' },
      select: {
        id: true,
        slot: true,
        fileSize: true,
        screenshotPath: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: saves.map((s) => ({
        ...s,
        fileSize: s.fileSize.toString(),
      })),
    });
  } catch (error) {
    logger.error('[saves] List error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * DELETE /api/saves/:id
 * Delete a save state
 */
export async function deleteSave(req, res) {
  try {
    const save = await prisma.saveState.findUnique({
      where: { id: req.params.id },
    });

    if (!save || save.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Save not found.' });
    }

    // Delete file from disk
    try {
      await fs.unlink(save.filepath);
    } catch {
      // File may not exist on disk, continue anyway
    }

    await prisma.saveState.delete({ where: { id: save.id } });

    res.json({ success: true, message: 'Save state deleted.' });
  } catch (error) {
    logger.error('[saves] Delete error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

export default { listSaves, deleteSave };
