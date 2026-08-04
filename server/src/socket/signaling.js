// ============================================================
// PS2 Cloud Gaming Platform — WebRTC Signaling
// Handles SDP offer/answer and ICE candidate exchange
// ============================================================

import { handleOffer, handleIceCandidate, isStreamActive } from '../services/streaming.service.js';
import logger from '../utils/logger.js';

// Track which socket is viewing which session
const sessionViewers = new Map(); // sessionId → Set<socketId>

/**
 * Setup WebRTC signaling handlers on a socket connection.
 *
 * @param {import('socket.io').Server} io - Socket.io server
 * @param {import('socket.io').Socket} socket - Connected socket
 */
export function setupSignaling(io, socket) {
  /**
   * Client joins a session room to receive the stream.
   * Event: session:join { sessionId }
   */
  socket.on('session:join', ({ sessionId }) => {
    if (!sessionId) return;

    socket.join(`session:${sessionId}`);

    // Track viewer
    if (!sessionViewers.has(sessionId)) {
      sessionViewers.set(sessionId, new Set());
    }
    sessionViewers.get(sessionId).add(socket.id);

    logger.info(`[signaling] ${socket.user?.username || socket.id} joined session ${sessionId}`);

    // Notify the session that a viewer has connected
    io.to(`session:${sessionId}`).emit('session:viewer-joined', {
      socketId: socket.id,
      username: socket.user?.username,
    });

    // If stream pipeline is already active, emit stream:ready directly to joining socket
    if (isStreamActive(sessionId)) {
      logger.info(`[signaling] Stream already active for ${sessionId}, emitting stream:ready to socket ${socket.id}`);
      socket.emit('stream:ready', { sessionId });
    }
  });

  /**
   * Client leaves a session room.
   * Event: session:leave { sessionId }
   */
  socket.on('session:leave', ({ sessionId }) => {
    socket.leave(`session:${sessionId}`);

    const viewers = sessionViewers.get(sessionId);
    if (viewers) {
      viewers.delete(socket.id);
      if (viewers.size === 0) sessionViewers.delete(sessionId);
    }

    logger.info(`[signaling] ${socket.user?.username || socket.id} left session ${sessionId}`);
  });

  /**
   * WebRTC SDP Offer from client
   * Event: signal:offer { sessionId, sdp }
   */
  socket.on('signal:offer', ({ sessionId, sdp }) => {
    logger.info(`[signaling] Offer received from ${socket.id} for session ${sessionId}`);
    handleOffer(sessionId, sdp, socket.id, io);
  });

  /**
   * WebRTC SDP Answer
   * Event: signal:answer { sessionId, sdp, to }
   */
  socket.on('signal:answer', ({ sessionId, sdp, to }) => {
    logger.info(`[signaling] Answer for session ${sessionId}`);

    if (to) {
      io.to(to).emit('signal:answer', { sdp });
    } else {
      socket.to(`session:${sessionId}`).emit('signal:answer', { sdp });
    }
  });

  /**
   * ICE Candidate exchange
   * Event: signal:ice-candidate { sessionId, candidate, to }
   */
  socket.on('signal:ice-candidate', ({ sessionId, candidate }) => {
    handleIceCandidate(sessionId, candidate);
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    for (const [sessionId, viewers] of sessionViewers) {
      if (viewers.has(socket.id)) {
        viewers.delete(socket.id);
        io.to(`session:${sessionId}`).emit('session:viewer-left', {
          socketId: socket.id,
        });
        if (viewers.size === 0) sessionViewers.delete(sessionId);
      }
    }
  });
}

export default { setupSignaling };
