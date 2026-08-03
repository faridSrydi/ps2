// ============================================================
// PS2 Cloud Gaming Platform — Socket.io Setup
// Central WebSocket handler for signaling, controller, monitoring
// ============================================================

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { setupSignaling } from './signaling.js';
import { setupControllerHandler } from './controller.js';
import { setupMonitoring } from './monitoring.js';
import logger from '../utils/logger.js';

/**
 * Initialize Socket.io with authentication and all handlers.
 *
 * @param {import('http').Server} httpServer - HTTP server instance
 * @returns {import('socket.io').Server} Socket.io server
 */
export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    maxHttpBufferSize: 1e6, // 1MB
  });

  // ─── Authentication Middleware ─────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ||
                  socket.handshake.query?.token;

    // Controller connections may not have auth tokens
    const isController = socket.handshake.query?.type === 'controller';

    if (isController) {
      // Controllers authenticate via roomId instead of JWT
      socket.isController = true;
      socket.roomId = socket.handshake.query?.roomId;
      return next();
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        socket.user = decoded;
        return next();
      } catch {
        return next(new Error('Authentication failed'));
      }
    }

    // Allow unauthenticated connections for public features
    next();
  });

  // ─── Connection Handler ────────────────────────────────
  io.on('connection', (socket) => {
    if (socket.isController) {
      logger.info(`[socket] Controller connected: ${socket.id} | Room: ${socket.roomId}`);
    } else if (socket.user) {
      logger.info(`[socket] User connected: ${socket.user.username} (${socket.id})`);
    } else {
      logger.info(`[socket] Anonymous connected: ${socket.id}`);
    }

    // Join user-specific room for targeted messages
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
    }

    // Setup handlers
    setupSignaling(io, socket);
    setupControllerHandler(io, socket);
    setupMonitoring(io, socket);

    // ─── Disconnect ──────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const name = socket.user?.username || socket.roomId || socket.id;
      logger.info(`[socket] Disconnected: ${name} (${reason})`);
    });

    // ─── Error Handler ───────────────────────────────────
    socket.on('error', (err) => {
      logger.error(`[socket] Error on ${socket.id}:`, err);
    });
  });

  logger.info('[socket] ✓ Socket.io initialized');

  return io;
}

export default { initializeSocket };
