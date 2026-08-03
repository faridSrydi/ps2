// ============================================================
// PS2 Cloud Gaming Platform — Library Scanner Service
// Scans game folder for PS2 ISOs and stores metadata in DB
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/database.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

// Supported game file extensions
const SUPPORTED_FORMATS = ['.iso', '.bin', '.chd', '.gz', '.cue'];

/**
 * Scan the games directory and sync with database.
 * - Adds new games found on disk
 * - Updates existing games if file changed
 * - Returns scan results
 *
 * @returns {{ added: number, updated: number, total: number }}
 */
export async function scanLibrary() {
  const gamesDir = config.paths.games;
  logger.info(`[library] Scanning: ${gamesDir}`);

  let added = 0;
  let updated = 0;

  try {
    // Ensure directory exists
    await fs.mkdir(gamesDir, { recursive: true });

    // Find all game files (recursive)
    const files = await findGameFiles(gamesDir);
    logger.info(`[library] Found ${files.length} game file(s)`);

    for (const filePath of files) {
      try {
        const stat = await fs.stat(filePath);
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();
        const title = cleanTitle(filename);
        const slug = slugify(title);

        // Extract serial from filename if present (e.g., "SLUS-12345")
        const serialMatch = filename.match(/(SL[A-Z]{2}-\d{3,5})/i);
        const serial = serialMatch ? serialMatch[1].toUpperCase() : null;

        // Detect region from serial or filename
        const region = detectRegion(serial, filename);

        // Check if game already exists
        const existing = await prisma.game.findFirst({
          where: {
            OR: [
              { filepath: filePath },
              { slug },
            ],
          },
        });

        if (existing) {
          // Update if file size changed (re-downloaded, etc.)
          if (existing.fileSize !== BigInt(stat.size)) {
            await prisma.game.update({
              where: { id: existing.id },
              data: {
                fileSize: BigInt(stat.size),
                scannedAt: new Date(),
              },
            });
            updated++;
          }
        } else {
          // Add new game
          await prisma.game.create({
            data: {
              title,
              slug: await ensureUniqueSlug(slug),
              filename,
              filepath: filePath,
              fileSize: BigInt(stat.size),
              format: ext.replace('.', ''),
              serial,
              region,
              coverPath: await findCover(title, serial),
            },
          });
          added++;
          logger.info(`[library] Added: ${title}`);
        }
      } catch (fileError) {
        logger.error(`[library] Error processing ${filePath}:`, fileError);
      }
    }

    const total = await prisma.game.count();
    logger.info(`[library] Scan complete: ${added} new, ${updated} updated, ${total} total`);

    return { added, updated, total };
  } catch (error) {
    logger.error('[library] Scan failed:', error);
    throw error;
  }
}

/**
 * Recursively find all game files in a directory
 */
async function findGameFiles(dir) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findGameFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.warn(`[library] Cannot read directory: ${dir}`);
  }

  return files;
}

/**
 * Clean a filename into a human-readable game title
 * "Final_Fantasy_X_(SLUS-20312).iso" → "Final Fantasy X"
 */
function cleanTitle(filename) {
  let title = path.basename(filename, path.extname(filename));

  // Remove serial codes
  title = title.replace(/\s*[\(\[](SL[A-Z]{2}-\d+)[\)\]]\s*/gi, '');

  // Remove region tags
  title = title.replace(/\s*[\(\[](USA|NTSC|PAL|EUR|JPN|JAP|NTSC-U|NTSC-J)[\)\]]\s*/gi, '');

  // Replace underscores and dots with spaces
  title = title.replace(/[_\.]/g, ' ');

  // Remove extra whitespace
  title = title.replace(/\s+/g, ' ').trim();

  return title || filename;
}

/**
 * Convert title to URL-safe slug
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure slug is unique by appending a number if needed
 */
async function ensureUniqueSlug(slug) {
  let candidate = slug;
  let counter = 1;

  while (await prisma.game.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${counter}`;
    counter++;
  }

  return candidate;
}

/**
 * Detect game region from serial code or filename
 */
function detectRegion(serial, filename) {
  if (serial) {
    if (serial.startsWith('SLUS') || serial.startsWith('SCUS')) return 'NTSC-U';
    if (serial.startsWith('SLES') || serial.startsWith('SCES')) return 'PAL';
    if (serial.startsWith('SLPS') || serial.startsWith('SCPS')) return 'NTSC-J';
    if (serial.startsWith('SLKA') || serial.startsWith('SCKA')) return 'NTSC-K';
  }

  const upper = filename.toUpperCase();
  if (upper.includes('USA') || upper.includes('NTSC-U')) return 'NTSC-U';
  if (upper.includes('EUR') || upper.includes('PAL')) return 'PAL';
  if (upper.includes('JPN') || upper.includes('JAP') || upper.includes('NTSC-J')) return 'NTSC-J';

  return null;
}

/**
 * Try to find a cover image for a game
 */
async function findCover(title, serial) {
  const coversDir = config.paths.covers;
  const candidates = [];

  if (serial) {
    candidates.push(`${serial}.jpg`, `${serial}.png`, `${serial}.webp`);
  }

  const slug = slugify(title);
  candidates.push(`${slug}.jpg`, `${slug}.png`, `${slug}.webp`);

  for (const filename of candidates) {
    const coverPath = path.join(coversDir, filename);
    try {
      await fs.access(coverPath);
      return `/covers/${filename}`;
    } catch {
      // Cover not found, try next
    }
  }

  return null;
}

export default { scanLibrary };
