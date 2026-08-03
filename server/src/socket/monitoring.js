// ============================================================
// PS2 Cloud Gaming Platform — Monitoring Socket Handler
// Broadcasts real-time system stats to admin dashboard
// ============================================================

import { getSystemStats } from '../services/monitoring.service.js';
import logger from '../utils/logger.js';

let monitoringInterval = null;

/**
 * Setup monitoring event handlers and periodic broadcasts.
 *
 * @param {import('socket.io').Server} io - Socket.io server
 * @param {import('socket.io').Socket} socket - Connected socket
 */
export function setupMonitoring(io, socket) {
  /**
   * Admin subscribes to real-time system stats.
   * Event: monitoring:subscribe
   */
  socket.on('monitoring:subscribe', () => {
    // Only admins can subscribe to monitoring
    if (!socket.user || socket.user.role !== 'ADMIN') {
      socket.emit('monitoring:error', { message: 'Admin access required.' });
      return;
    }

    socket.join('monitoring');
    logger.info(`[monitoring] Admin ${socket.user.username} subscribed to stats`);

    // Send initial stats immediately
    sendStats(socket);

    // Start periodic broadcasting if not already running
    startBroadcasting(io);
  });

  /**
   * Admin unsubscribes from monitoring.
   * Event: monitoring:unsubscribe
   */
  socket.on('monitoring:unsubscribe', () => {
    socket.leave('monitoring');
    logger.info(`[monitoring] Admin unsubscribed from stats`);

    // Stop broadcasting if no one is listening
    const monitoringRoom = io.sockets.adapter.rooms.get('monitoring');
    if (!monitoringRoom || monitoringRoom.size === 0) {
      stopBroadcasting();
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    const monitoringRoom = io.sockets.adapter.rooms.get('monitoring');
    if (!monitoringRoom || monitoringRoom.size === 0) {
      stopBroadcasting();
    }
  });
}

/**
 * Send current stats to a specific socket
 */
async function sendStats(socket) {
  try {
    const stats = await getSystemStats();
    socket.emit('stats:system', stats);
  } catch (error) {
    logger.error('[monitoring] Failed to get stats:', error);
  }
}

/**
 * Start periodic stats broadcasting to all monitoring subscribers.
 * Broadcasts every 2 seconds.
 */
function startBroadcasting(io) {
  if (monitoringInterval) return; // Already running

  monitoringInterval = setInterval(async () => {
    try {
      const stats = await getSystemStats();
      io.to('monitoring').emit('stats:system', stats);
    } catch (error) {
      logger.error('[monitoring] Broadcast error:', error);
    }
  }, 2000); // Every 2 seconds

  logger.info('[monitoring] Started broadcasting stats');
}

/**
 * Stop periodic stats broadcasting
 */
function stopBroadcasting() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    logger.info('[monitoring] Stopped broadcasting stats');
  }
}

export default { setupMonitoring };
