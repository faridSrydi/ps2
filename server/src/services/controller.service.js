// ============================================================
// PS2 Cloud Gaming Platform — Controller Service
// Virtual gamepad via Linux uinput for input injection
// ============================================================

import { spawn } from 'child_process';
import logger from '../utils/logger.js';

// Track active virtual gamepads: sessionId → { process, devicePath }
const activeGamepads = new Map();

// PS2 button mapping to Linux input event codes
const BUTTON_MAP = {
  cross: 'BTN_SOUTH',        // ✕
  circle: 'BTN_EAST',        // ○
  square: 'BTN_WEST',        // □
  triangle: 'BTN_NORTH',     // △
  l1: 'BTN_TL',
  r1: 'BTN_TR',
  l2: 'BTN_TL2',
  r2: 'BTN_TR2',
  l3: 'BTN_THUMBL',          // Left stick press
  r3: 'BTN_THUMBR',          // Right stick press
  start: 'BTN_START',
  select: 'BTN_SELECT',
  dpad_up: 'BTN_DPAD_UP',
  dpad_down: 'BTN_DPAD_DOWN',
  dpad_left: 'BTN_DPAD_LEFT',
  dpad_right: 'BTN_DPAD_RIGHT',
};

// PS2 analog axis mapping
const AXIS_MAP = {
  left_x: 'ABS_X',           // Left stick horizontal
  left_y: 'ABS_Y',           // Left stick vertical
  right_x: 'ABS_RX',         // Right stick horizontal
  right_y: 'ABS_RY',         // Right stick vertical
  l2_analog: 'ABS_Z',        // L2 pressure
  r2_analog: 'ABS_RZ',       // R2 pressure
};

/**
 * Create a virtual gamepad for a session using evdev/uinput.
 * This creates a virtual game controller that PCSX2 can detect.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} playerNumber - Player 1 or 2
 * @returns {{ devicePath: string }}
 */
export async function createVirtualGamepad(sessionId, playerNumber = 1) {
  const deviceName = `PS2Cloud-P${playerNumber}-${sessionId.slice(0, 8)}`;

  logger.info(`[controller] Creating virtual gamepad: ${deviceName}`);

  // We use a Python helper script that creates a uinput device
  // This is more reliable than raw Node.js uinput bindings
  const pythonScript = `
import uinput
import sys
import json
import time

device = uinput.Device([
    uinput.BTN_SOUTH, uinput.BTN_EAST, uinput.BTN_WEST, uinput.BTN_NORTH,
    uinput.BTN_TL, uinput.BTN_TR, uinput.BTN_TL2, uinput.BTN_TR2,
    uinput.BTN_THUMBL, uinput.BTN_THUMBR,
    uinput.BTN_START, uinput.BTN_SELECT,
    uinput.BTN_DPAD_UP, uinput.BTN_DPAD_DOWN,
    uinput.BTN_DPAD_LEFT, uinput.BTN_DPAD_RIGHT,
    uinput.ABS_X + (0, 255, 0, 0),
    uinput.ABS_Y + (0, 255, 0, 0),
    uinput.ABS_RX + (0, 255, 0, 0),
    uinput.ABS_RY + (0, 255, 0, 0),
    uinput.ABS_Z + (0, 255, 0, 0),
    uinput.ABS_RZ + (0, 255, 0, 0),
], name="${deviceName}", bustype=uinput.BUS_USB)

print(json.dumps({"status": "ready", "name": "${deviceName}"}), flush=True)

# Read commands from stdin (JSON per line)
for line in sys.stdin:
    try:
        cmd = json.loads(line.strip())
        if cmd["type"] == "button":
            code = getattr(uinput, cmd["code"])
            device.emit(code, cmd["value"])
        elif cmd["type"] == "axis":
            code = getattr(uinput, cmd["code"])
            device.emit(code, cmd["value"], syn=True)
        elif cmd["type"] == "quit":
            break
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)

device.destroy()
`;

  try {
    const gamepad = spawn('python3', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for "ready" signal
    const devicePath = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Gamepad creation timeout')), 5000);

      gamepad.stdout.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const msg = JSON.parse(data.toString().trim());
          if (msg.status === 'ready') {
            resolve(msg.name);
          } else {
            reject(new Error('Unexpected response'));
          }
        } catch {
          reject(new Error('Invalid response from gamepad script'));
        }
      });

      gamepad.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    activeGamepads.set(`${sessionId}-P${playerNumber}`, {
      process: gamepad,
      deviceName,
      playerNumber,
    });

    logger.info(`[controller] ✓ Virtual gamepad created: ${deviceName}`);

    return { devicePath: deviceName };
  } catch (error) {
    logger.error(`[controller] Failed to create virtual gamepad:`, error);
    // Fallback: log that virtual gamepad is unavailable
    logger.warn(`[controller] Falling back to keyboard input injection`);
    return { devicePath: null };
  }
}

/**
 * Send an input event to a virtual gamepad.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} playerNumber - Player 1 or 2
 * @param {object} input - { type: 'button'|'axis', button/axis: string, value: number }
 */
export function sendInput(sessionId, playerNumber, input) {
  const key = `${sessionId}-P${playerNumber}`;
  const gamepad = activeGamepads.get(key);

  if (!gamepad) {
    logger.warn(`[controller] No gamepad found for ${key}`);
    return;
  }

  try {
    let command;

    if (input.type === 'button') {
      const code = BUTTON_MAP[input.button];
      if (!code) return;
      command = { type: 'button', code, value: input.value ? 1 : 0 };
    } else if (input.type === 'axis') {
      const code = AXIS_MAP[input.axis];
      if (!code) return;
      // Convert from -32768..32767 to 0..255 for uinput
      const normalized = Math.round(((input.value + 32768) / 65535) * 255);
      command = { type: 'axis', code, value: normalized };
    } else {
      return;
    }

    gamepad.process.stdin.write(JSON.stringify(command) + '\n');
  } catch (error) {
    logger.error(`[controller] Input injection error:`, error);
  }
}

/**
 * Destroy a virtual gamepad
 */
export function destroyGamepad(sessionId, playerNumber = 1) {
  const key = `${sessionId}-P${playerNumber}`;
  const gamepad = activeGamepads.get(key);

  if (gamepad) {
    try {
      gamepad.process.stdin.write(JSON.stringify({ type: 'quit' }) + '\n');
      setTimeout(() => {
        try { gamepad.process.kill(); } catch { /* already dead */ }
      }, 1000);
    } catch {
      // Process already terminated
    }
    activeGamepads.delete(key);
    logger.info(`[controller] Destroyed gamepad: ${key}`);
  }
}

/**
 * Destroy all gamepads for a session
 */
export function destroySessionGamepads(sessionId) {
  destroyGamepad(sessionId, 1);
  destroyGamepad(sessionId, 2);
}

export default {
  createVirtualGamepad,
  sendInput,
  destroyGamepad,
  destroySessionGamepads,
};
