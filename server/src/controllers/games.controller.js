// ============================================================
// PS2 Cloud Gaming Platform — Games Controller
// Handles game library, search, and metadata
// ============================================================

import prisma from '../config/database.js';
import { scanLibrary } from '../services/library.service.js';
import logger from '../utils/logger.js';

/**
 * GET /api/games
 * List all games with pagination, search, and filters
 */
export async function listGames(req, res) {
  try {
    const {
      q,                             // Search query
      genre,                         // Filter by genre
      region,                        // Filter by region
      sort = 'title',                // Sort field
      order = 'asc',                 // Sort order
      page = 1,
      limit = 20,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { serial: { contains: q, mode: 'insensitive' } },
        { developer: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (genre) where.genre = { contains: genre, mode: 'insensitive' };
    if (region) where.region = region;

    // Build orderBy
    const validSorts = ['title', 'playCount', 'releaseYear', 'createdAt'];
    const orderField = validSorts.includes(sort) ? sort : 'title';
    const orderDir = order === 'desc' ? 'desc' : 'asc';

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        orderBy: { [orderField]: orderDir },
        skip,
        take,
        select: {
          id: true,
          title: true,
          slug: true,
          serial: true,
          region: true,
          genre: true,
          developer: true,
          coverPath: true,
          rating: true,
          playCount: true,
          releaseYear: true,
        },
      }),
      prisma.game.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        games,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error) {
    logger.error('[games] List error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/games/:id
 * Get detailed game info
 */
export async function getGame(req, res) {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            favorites: true,
            sessions: true,
          },
        },
      },
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found.',
      });
    }

    // Check if current user has favorited this game
    let isFavorited = false;
    if (req.user) {
      const fav = await prisma.favorite.findUnique({
        where: {
          userId_gameId: {
            userId: req.user.id,
            gameId: game.id,
          },
        },
      });
      isFavorited = !!fav;
    }

    res.json({
      success: true,
      data: {
        ...game,
        fileSize: game.fileSize.toString(), // BigInt → string
        isFavorited,
        favoriteCount: game._count.favorites,
        sessionCount: game._count.sessions,
      },
    });
  } catch (error) {
    logger.error('[games] Get game error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/games/search
 * Search games by title
 */
export async function searchGames(req, res) {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ success: true, data: [] });
    }

    const games = await prisma.game.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { serial: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        title: true,
        slug: true,
        coverPath: true,
        genre: true,
        region: true,
      },
    });

    res.json({ success: true, data: games });
  } catch (error) {
    logger.error('[games] Search error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/games/rescan
 * Trigger a library rescan (admin only)
 */
export async function rescanLibrary(req, res) {
  try {
    const result = await scanLibrary();

    logger.info(`[games] Library rescan: ${result.added} new, ${result.updated} updated, ${result.total} total`);

    res.json({
      success: true,
      message: 'Library scan complete.',
      data: result,
    });
  } catch (error) {
    logger.error('[games] Rescan error:', error);
    res.status(500).json({ success: false, message: 'Library scan failed.' });
  }
}

export default { listGames, getGame, searchGames, rescanLibrary };
