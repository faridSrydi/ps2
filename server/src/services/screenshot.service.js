// ============================================================
// PS2 Cloud Gaming Platform — Screenshot Service
// Captures screenshots from the virtual display
// ============================================================

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import config from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Capture a screenshot from a virtual display.
 * Uses xdotool + import (ImageMagick) or scrot.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} displayNumber - Xvfb display number
 * @returns {string} Path to the saved screenshot
 */
export async function captureScreenshot(sessionId, displayNumber) {
  const timestamp = Date.now();
  const filename = `${sessionId}_${timestamp}.png`;
  const filepath = path.join(config.paths.screenshots, filename);

  // Ensure screenshots directory exists
  await fs.mkdir(config.paths.screenshots, { recursive: true });

  try {
    // Use `import` from ImageMagick to capture the display
    execSync(
      `DISPLAY=:${displayNumber} import -window root ${filepath}`,
      { timeout: 10000 }
    );

    logger.info(`[screenshot] Captured: ${filename}`);

    return `/screenshots/${filename}`;
  } catch (error) {
    logger.error(`[screenshot] Capture failed:`, error);

    // Fallback: try xdotool + scrot
    try {
      execSync(
        `DISPLAY=:${displayNumber} scrot ${filepath}`,
        { timeout: 10000 }
      );
      logger.info(`[screenshot] Captured (scrot fallback): ${filename}`);
      return `/screenshots/${filename}`;
    } catch {
      throw new Error('Screenshot capture failed — neither import nor scrot available');
    }
  }
}

export default { captureScreenshot };
