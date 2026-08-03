// ============================================================
// PS2 Cloud Gaming Platform — Favorites Controller
// Manage user's favorite games
// ============================================================

import prisma from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * GET /api/favorites
 * List current user's favorite games
 */
export async function listFavorites(req, res) {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        game: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverPath: true,
            genre: true,
            region: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: favorites.map((f) => ({
        ...f.game,
        favoritedAt: f.createdAt,
      })),
    });
  } catch (error) {
    logger.error('[favorites] List error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/favorites
 * Add a game to favorites
 */
export async function addFavorite(req, res) {
  try {
    const { gameId } = req.body;

    // Check game exists
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found.' });
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_gameId: { userId: req.user.id, gameId },
      },
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'Already in favorites.' });
    }

    await prisma.favorite.create({
      data: { userId: req.user.id, gameId },
    });

    logger.info(`[favorites] Added: ${game.title} | User: ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Added to favorites.',
    });
  } catch (error) {
    logger.error('[favorites] Add error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * DELETE /api/favorites/:gameId
 * Remove a game from favorites
 */
export async function removeFavorite(req, res) {
  try {
    const { gameId } = req.params;

    const deleted = await prisma.favorite.deleteMany({
      where: {
        userId: req.user.id,
        gameId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ success: false, message: 'Not in favorites.' });
    }

    res.json({ success: true, message: 'Removed from favorites.' });
  } catch (error) {
    logger.error('[favorites] Remove error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

export default { listFavorites, addFavorite, removeFavorite };
