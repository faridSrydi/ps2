// ============================================================
// PS2 Cloud Gaming Platform — Session Controller
// Handles game session lifecycle: create, play, stop
// ============================================================

import prisma from '../config/database.js';
import { generateRoomId } from '../utils/roomId.js';
import { generateQRCode } from '../utils/qrcode.js';
import { launchEmulator, stopEmulator } from '../services/emulator.service.js';
import { startStream, stopStream } from '../services/streaming.service.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';

/**
 * POST /api/sessions
 * Create a new game session (Play button clicked)
 */
export async function createSession(req, res) {
  try {
    const { gameId } = req.body;
    const userId = req.user.id;

    // Check if user already has an active session
    const activeSession = await prisma.session.findFirst({
      where: {
        userId,
        status: { in: ['CREATING', 'RUNNING', 'PAUSED'] },
      },
    });

    if (activeSession) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active session. Stop it before starting a new one.',
        data: { sessionId: activeSession.id, roomId: activeSession.roomId },
      });
    }

    // Check max concurrent sessions
    const activeSessions = await prisma.session.count({
      where: { status: { in: ['CREATING', 'RUNNING', 'PAUSED'] } },
    });

    if (activeSessions >= config.session.maxConcurrent) {
      return res.status(503).json({
        success: false,
        message: 'Server is at maximum capacity. Please try again later.',
      });
    }

    // Verify game exists
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found.',
      });
    }

    // Generate room ID and create session
    const roomId = generateRoomId();
    const session = await prisma.session.create({
      data: {
        userId,
        gameId,
        roomId,
        status: 'CREATING',
      },
    });

    // Generate QR code for controller pairing
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const qr = await generateQRCode(roomId, baseUrl);

    // Launch emulator and streaming in background
    const io = req.app.get('io');
    launchSession(session.id, game, io).catch((err) => {
      logger.error(`[session] Failed to launch session ${session.id}:`, err);
    });

    // Update play count
    await prisma.game.update({
      where: { id: gameId },
      data: { playCount: { increment: 1 } },
    });

    // Record in recently played
    await prisma.recentlyPlayed.create({
      data: { userId, gameId },
    });

    logger.info(`[session] Created: ${roomId} | Game: ${game.title} | User: ${req.user.username}`);

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        roomId,
        qrCode: qr.dataUrl,
        controllerUrl: qr.controllerUrl,
        game: {
          id: game.id,
          title: game.title,
          coverPath: game.coverPath,
        },
      },
    });
  } catch (error) {
    logger.error('[session] Create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create session.' });
  }
}

/**
 * Internal: Launch the emulator and streaming pipeline
 */
async function launchSession(sessionId, game, io) {
  try {
    // Launch PCSX2 emulator
    const emulatorInfo = await launchEmulator(sessionId, game.filepath);

    // Start streaming pipeline
    const streamInfo = await startStream(sessionId, emulatorInfo.displayNumber);

    // Update session with process info
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'RUNNING',
        pcsx2Pid: emulatorInfo.pid,
        displayNumber: emulatorInfo.displayNumber,
        portWebrtc: streamInfo.port,
      },
    });

    logger.info(`[session] Launched: ${sessionId} | PID: ${emulatorInfo.pid} | Display: :${emulatorInfo.displayNumber}`);

    // Notify clients in the session room that the stream is ready for WebRTC
    if (io) {
      io.to(`session:${sessionId}`).emit('stream:ready', { sessionId });
      logger.info(`[session] Emitted stream:ready for session ${sessionId}`);
    }
  } catch (error) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'ERROR', metadata: { error: error.message } },
    });
    throw error;
  }
}

/**
 * GET /api/sessions/:id
 * Get session info including QR code and status
 */
export async function getSession(req, res) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        game: {
          select: { id: true, title: true, coverPath: true },
        },
        controllerPairs: {
          select: { deviceId: true, playerNumber: true, status: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.',
      });
    }

    // Only session owner or admin can view
    if (session.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const qr = await generateQRCode(session.roomId, baseUrl);

    res.json({
      success: true,
      data: {
        ...session,
        qrCode: qr.dataUrl,
        controllerUrl: qr.controllerUrl,
      },
    });
  } catch (error) {
    logger.error('[session] Get error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/sessions/:id/pause
 * Pause the emulator
 */
export async function pauseSession(req, res) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (session.status !== 'RUNNING') {
      return res.status(400).json({ success: false, message: 'Session is not running.' });
    }

    // Send pause signal to PCSX2
    if (session.pcsx2Pid) {
      process.kill(session.pcsx2Pid, 'SIGSTOP');
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'PAUSED' },
    });

    res.json({ success: true, message: 'Session paused.' });
  } catch (error) {
    logger.error('[session] Pause error:', error);
    res.status(500).json({ success: false, message: 'Failed to pause session.' });
  }
}

/**
 * POST /api/sessions/:id/resume
 * Resume a paused session
 */
export async function resumeSession(req, res) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (session.status !== 'PAUSED') {
      return res.status(400).json({ success: false, message: 'Session is not paused.' });
    }

    // Send continue signal to PCSX2
    if (session.pcsx2Pid) {
      process.kill(session.pcsx2Pid, 'SIGCONT');
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'RUNNING' },
    });

    res.json({ success: true, message: 'Session resumed.' });
  } catch (error) {
    logger.error('[session] Resume error:', error);
    res.status(500).json({ success: false, message: 'Failed to resume session.' });
  }
}

/**
 * DELETE /api/sessions/:id
 * Stop and destroy a session
 */
export async function destroySession(req, res) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    // Only owner or admin can destroy
    if (session.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Stop emulator and streaming
    await stopEmulator(session.id, session.pcsx2Pid);
    await stopStream(session.id);

    // Calculate duration
    const duration = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

    // Update session record
    await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'STOPPED',
        endedAt: new Date(),
        durationSecs: duration,
      },
    });

    // Update recently played duration
    await prisma.recentlyPlayed.updateMany({
      where: {
        userId: session.userId,
        gameId: session.gameId,
      },
      data: { playDurationSecs: { increment: duration } },
    });

    logger.info(`[session] Destroyed: ${session.roomId} | Duration: ${duration}s`);

    res.json({
      success: true,
      message: 'Session ended.',
      data: { duration },
    });
  } catch (error) {
    logger.error('[session] Destroy error:', error);
    res.status(500).json({ success: false, message: 'Failed to stop session.' });
  }
}

/**
 * POST /api/sessions/:id/screenshot
 * Capture a screenshot of the current game
 */
export async function captureScreenshot(req, res) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (session.status !== 'RUNNING') {
      return res.status(400).json({ success: false, message: 'Session is not running.' });
    }

    // Import screenshot service dynamically to avoid circular deps
    const { captureScreenshot: capture } = await import('../services/screenshot.service.js');
    const filepath = await capture(session.id, session.displayNumber);

    // Save to database
    const screenshot = await prisma.screenshot.create({
      data: {
        userId: session.userId,
        gameId: session.gameId,
        sessionId: session.id,
        filepath,
      },
    });

    res.json({
      success: true,
      data: { id: screenshot.id, filepath },
    });
  } catch (error) {
    logger.error('[session] Screenshot error:', error);
    res.status(500).json({ success: false, message: 'Failed to capture screenshot.' });
  }
}

/**
 * POST /api/sessions/:id/save
 * Create a save state
 */
export async function saveState(req, res) {
  try {
    const { slot = 1 } = req.body;
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    if (session.status !== 'RUNNING') {
      return res.status(400).json({ success: false, message: 'Session is not running.' });
    }

    // TODO: Trigger PCSX2 save state via hotkey injection
    // For now, create a placeholder record
    const filepath = `${config.paths.saves}/${session.userId}/${session.gameId}/slot${slot}.p2s`;

    const save = await prisma.saveState.upsert({
      where: {
        userId_gameId_slot: {
          userId: session.userId,
          gameId: session.gameId,
          slot,
        },
      },
      update: {
        filepath,
        fileSize: BigInt(0),
        createdAt: new Date(),
      },
      create: {
        userId: session.userId,
        gameId: session.gameId,
        slot,
        filepath,
        fileSize: BigInt(0),
      },
    });

    logger.info(`[session] Save state: slot ${slot} | Session: ${session.roomId}`);

    res.json({
      success: true,
      message: `Game saved to slot ${slot}.`,
      data: { id: save.id, slot },
    });
  } catch (error) {
    logger.error('[session] Save state error:', error);
    res.status(500).json({ success: false, message: 'Failed to save state.' });
  }
}

export default {
  createSession,
  getSession,
  pauseSession,
  resumeSession,
  destroySession,
  captureScreenshot,
  saveState,
};
