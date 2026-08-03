// ============================================================
// PS2 Cloud Gaming Platform — Emulator Service
// Manages PCSX2 process lifecycle (launch, stop, per session)
// ============================================================

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import config from '../config/env.js';
import logger from '../utils/logger.js';

// Track active emulator processes: sessionId → { process, displayNumber }
const activeProcesses = new Map();

// Track used display numbers to avoid conflicts
let nextDisplayNumber = 10;

/**
 * Launch a PCSX2 emulator instance for a game session.
 * Creates a virtual display (Xvfb) and starts PCSX2 in it.
 *
 * @param {string} sessionId - Session UUID
 * @param {string} gamePath - Full path to the game ISO
 * @returns {{ pid: number, displayNumber: number }}
 */
export async function launchEmulator(sessionId, gamePath) {
  // Validate game file exists
  if (!existsSync(gamePath)) {
    throw new Error(`Game file not found: ${gamePath}`);
  }

  const displayNumber = nextDisplayNumber++;
  const display = `:${displayNumber}`;

  logger.info(`[emulator] Launching session ${sessionId} on display ${display}`);
  logger.info(`[emulator] Game: ${gamePath}`);

  try {
    // 1. Start Xvfb (virtual display)
    const [width, height] = config.streaming.resolution.split('x');
    const xvfb = spawn('Xvfb', [
      display,
      '-screen', '0', `${width}x${height}x24`,
      '-ac',           // Disable access control
      '+extension', 'GLX',
      '+extension', 'RANDR',
    ], {
      stdio: 'ignore',
      detached: true,
    });
    xvfb.unref();

    // Wait for Xvfb to initialize
    await sleep(1000);

    // 2. Launch PCSX2
    const pcsx2Args = [
      '-nogui',                     // No GUI window
      '-fullscreen',                // Fullscreen in virtual display
      '-bios', config.pcsx2.biosPath,
      gamePath,
    ];

    const pcsx2 = spawn(config.pcsx2.binary, pcsx2Args, {
      env: {
        ...process.env,
        DISPLAY: display,
        // Use Vulkan renderer for GPU acceleration
        MESA_VK_DEVICE_SELECT: '10de:',  // Prefer NVIDIA
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    // Handle process output
    pcsx2.stdout.on('data', (data) => {
      logger.debug(`[pcsx2:${sessionId}] ${data.toString().trim()}`);
    });

    pcsx2.stderr.on('data', (data) => {
      logger.warn(`[pcsx2:${sessionId}] stderr: ${data.toString().trim()}`);
    });

    pcsx2.on('exit', (code, signal) => {
      logger.info(`[pcsx2:${sessionId}] Exited with code ${code}, signal ${signal}`);
      cleanupSession(sessionId);
    });

    pcsx2.on('error', (err) => {
      logger.error(`[pcsx2:${sessionId}] Error:`, err);
    });

    // Store process references
    activeProcesses.set(sessionId, {
      pcsx2,
      xvfb,
      displayNumber,
      pid: pcsx2.pid,
    });

    logger.info(`[emulator] ✓ Session ${sessionId} launched | PID: ${pcsx2.pid} | Display: ${display}`);

    return {
      pid: pcsx2.pid,
      displayNumber,
    };
  } catch (error) {
    logger.error(`[emulator] Failed to launch session ${sessionId}:`, error);
    cleanupSession(sessionId);
    throw error;
  }
}

/**
 * Stop an emulator instance and clean up resources.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} pid - PCSX2 process ID (optional, used as fallback)
 */
export async function stopEmulator(sessionId, pid) {
  const session = activeProcesses.get(sessionId);

  if (session) {
    logger.info(`[emulator] Stopping session ${sessionId}`);

    // Kill PCSX2
    try {
      session.pcsx2.kill('SIGTERM');
      // Give it 5s to shut down gracefully, then force kill
      setTimeout(() => {
        try {
          session.pcsx2.kill('SIGKILL');
        } catch {
          // Already dead
        }
      }, 5000);
    } catch {
      // Process may already be dead
    }

    // Kill Xvfb
    try {
      session.xvfb.kill('SIGTERM');
    } catch {
      // Already dead
    }

    cleanupSession(sessionId);
  } else if (pid) {
    // Fallback: kill by PID if we lost the reference
    try {
      process.kill(pid, 'SIGTERM');
      setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL');
        } catch { /* already dead */ }
      }, 5000);
    } catch {
      // Process doesn't exist
    }
  }
}

/**
 * Clean up session tracking data
 */
function cleanupSession(sessionId) {
  activeProcesses.delete(sessionId);
}

/**
 * Get info about all active emulator processes
 */
export function getActiveEmulators() {
  const result = [];
  for (const [sessionId, info] of activeProcesses) {
    result.push({
      sessionId,
      pid: info.pid,
      displayNumber: info.displayNumber,
    });
  }
  return result;
}

/**
 * Check if an emulator process is still alive
 */
export function isEmulatorRunning(sessionId) {
  const session = activeProcesses.get(sessionId);
  if (!session) return false;

  try {
    process.kill(session.pid, 0); // Signal 0 = check if process exists
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the count of currently running emulators
 */
export function getActiveCount() {
  return activeProcesses.size;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  launchEmulator,
  stopEmulator,
  getActiveEmulators,
  isEmulatorRunning,
  getActiveCount,
};
