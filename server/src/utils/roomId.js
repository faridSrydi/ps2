// ============================================================
// PS2 Cloud Gaming Platform — Room ID Generator
// Generates unique room IDs in format: ABCD-1234
// ============================================================

import crypto from 'crypto';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I, O to avoid confusion
const DIGITS = '0123456789';

/**
 * Generate a random room ID in format XXXX-NNNN
 * e.g., "ABCD-1234"
 * @returns {string} Room ID
 */
export function generateRoomId() {
  let id = '';

  // 4 random letters
  for (let i = 0; i < 4; i++) {
    const idx = crypto.randomInt(0, LETTERS.length);
    id += LETTERS[idx];
  }

  id += '-';

  // 4 random digits
  for (let i = 0; i < 4; i++) {
    const idx = crypto.randomInt(0, DIGITS.length);
    id += DIGITS[idx];
  }

  return id;
}

/**
 * Validate a room ID format
 * @param {string} roomId - Room ID to validate
 * @returns {boolean} True if valid
 */
export function isValidRoomId(roomId) {
  return /^[A-Z]{4}-[0-9]{4}$/.test(roomId);
}

export default { generateRoomId, isValidRoomId };
