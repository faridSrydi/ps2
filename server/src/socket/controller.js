// ============================================================
// PS2 Cloud Gaming Platform — Controller Socket Handler
// Handles controller pairing and input events from phones
// ============================================================

import prisma from '../config/database.js';
import { sendInput, createVirtualGamepad } from '../services/controller.service.js';
import logger from '../utils/logger.js';

// Track paired controllers: roomId → { sessionId, sockets }
const pairedControllers = new Map();

/**
 * Setup controller event handlers on a socket connection.
 *
 * @param {import('socket.io').Server} io - Socket.io server
 * @param {import('socket.io').Socket} socket - Connected socket
 */
export function setupControllerHandler(io, socket) {
  /**
   * Controller pairing request (from phone after QR scan)
   * Event: controller:pair { roomId, deviceId, deviceName, playerNumber }
   */
  socket.on('controller:pair', async ({ roomId, deviceId, deviceName, playerNumber = 1 }) => {
    try {
      if (!roomId) {
        socket.emit('controller:error', { message: 'Room ID is required.' });
        return;
      }

      // Find the session by room ID
      const session = await prisma.session.findUnique({
        where: { roomId },
      });

      if (!session) {
        socket.emit('controller:error', { message: 'Invalid room ID. Session not found.' });
        return;
      }

      if (session.status === 'STOPPED' || session.status === 'ERROR') {
        socket.emit('controller:error', { message: 'Session has ended.' });
        return;
      }

      // Check if player slot is available
      const existingPair = await prisma.controllerPair.findUnique({
        where: {
          sessionId_playerNumber: {
            sessionId: session.id,
            playerNumber,
          },
        },
      });

      if (existingPair && existingPair.status === 'PAIRED') {
        socket.emit('controller:error', {
          message: `Player ${playerNumber} slot is already taken.`,
        });
        return;
      }

      // Create or update controller pair in DB
      await prisma.controllerPair.upsert({
        where: {
          sessionId_playerNumber: {
            sessionId: session.id,
            playerNumber,
          },
        },
        create: {
          sessionId: session.id,
          deviceId: deviceId || socket.id,
          deviceName: deviceName || 'Phone Controller',
          playerNumber,
          status: 'PAIRED',
        },
        update: {
          deviceId: deviceId || socket.id,
          deviceName: deviceName || 'Phone Controller',
          status: 'PAIRED',
          pairedAt: new Date(),
        },
      });

      // Create virtual gamepad for this controller
      await createVirtualGamepad(session.id, playerNumber);

      // Join the session room
      socket.join(`session:${session.id}`);
      socket.sessionId = session.id;
      socket.playerNumber = playerNumber;

      // Track pairing
      if (!pairedControllers.has(roomId)) {
        pairedControllers.set(roomId, { sessionId: session.id, sockets: new Map() });
      }
      pairedControllers.get(roomId).sockets.set(socket.id, { playerNumber });

      logger.info(`[controller] Paired: Room ${roomId} | Player ${playerNumber} | Device: ${deviceName}`);

      // Confirm pairing to the phone
      socket.emit('controller:paired', {
        success: true,
        sessionId: session.id,
        playerNumber,
        gameTitle: session.gameId, // TODO: join game title
      });

      // Notify the browser that a controller has connected
      io.to(`session:${session.id}`).emit('controller:connected', {
        playerNumber,
        deviceName: deviceName || 'Phone Controller',
      });
    } catch (error) {
      logger.error('[controller] Pair error:', error);
      socket.emit('controller:error', { message: 'Pairing failed.' });
    }
  });

  /**
   * Controller input event (from phone during gameplay)
   * Uses binary data for performance when possible.
   *
   * Event: controller:input { type, button/axis, value }
   *
   * Binary format (8 bytes):
   * [0]     = Message type (0x01=button, 0x02=analog)
   * [1]     = Button/Axis ID
   * [2-3]   = Value (int16)
   * [4-7]   = Timestamp (uint32)
   */
  socket.on('controller:input', (data) => {
    if (!socket.sessionId) return;

    try {
      let input;

      if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
        // Binary input (faster)
        input = decodeBinaryInput(data);
      } else {
        // JSON input (fallback)
        input = data;
      }

      sendInput(socket.sessionId, socket.playerNumber || 1, input);
    } catch (error) {
      // Silently drop bad input — don't log every bad packet
    }
  });

  /**
   * Controller vibration feedback (from server to phone)
   * Event: controller:vibrate { intensity, duration }
   */
  socket.on('controller:vibrate', ({ intensity = 1.0, duration = 200 }) => {
    // Forward vibration to the phone
    socket.emit('controller:vibrate', { intensity, duration });
  });

  // Cleanup on disconnect
  socket.on('disconnect', async () => {
    if (socket.sessionId && socket.playerNumber) {
      try {
        await prisma.controllerPair.updateMany({
          where: {
            sessionId: socket.sessionId,
            playerNumber: socket.playerNumber,
          },
          data: { status: 'DISCONNECTED' },
        });

        // Notify session viewers
        io.to(`session:${socket.sessionId}`).emit('controller:disconnected', {
          playerNumber: socket.playerNumber,
        });

        logger.info(`[controller] Disconnected: Session ${socket.sessionId} | Player ${socket.playerNumber}`);
      } catch (error) {
        logger.error('[controller] Disconnect cleanup error:', error);
      }
    }
  });
}

// ─── Button/Axis ID Maps for Binary Protocol ─────────────

const BINARY_BUTTON_MAP = {
  0x00: 'cross',
  0x01: 'circle',
  0x02: 'square',
  0x03: 'triangle',
  0x04: 'l1',
  0x05: 'r1',
  0x06: 'l2',
  0x07: 'r2',
  0x08: 'select',
  0x09: 'start',
  0x0A: 'l3',
  0x0B: 'r3',
  0x0C: 'dpad_up',
  0x0D: 'dpad_down',
  0x0E: 'dpad_left',
  0x0F: 'dpad_right',
};

const BINARY_AXIS_MAP = {
  0x00: 'left_x',
  0x01: 'left_y',
  0x02: 'right_x',
  0x03: 'right_y',
  0x04: 'l2_analog',
  0x05: 'r2_analog',
};

/**
 * Decode binary input data from the controller.
 *
 * @param {Buffer|ArrayBuffer} data - 8-byte binary input
 * @returns {object} Decoded input { type, button/axis, value }
 */
function decodeBinaryInput(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

  const msgType = buf.readUInt8(0);
  const id = buf.readUInt8(1);
  const value = buf.readInt16LE(2);

  if (msgType === 0x01) {
    // Button press/release
    return {
      type: 'button',
      button: BINARY_BUTTON_MAP[id] || 'unknown',
      value: value ? 1 : 0,
    };
  } else if (msgType === 0x02) {
    // Analog axis
    return {
      type: 'axis',
      axis: BINARY_AXIS_MAP[id] || 'unknown',
      value,
    };
  }

  return { type: 'unknown' };
}

export default { setupControllerHandler };
