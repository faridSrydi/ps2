// ============================================================
// PS2 Cloud Gaming Platform — Streaming Service
// GStreamer pipeline for screen capture → NVENC → WebRTC
// ============================================================

import { spawn, execSync } from 'child_process';
import config from '../config/env.js';
import logger from '../utils/logger.js';

// Track active streaming pipelines: sessionId → { process, port }
const activePipelines = new Map();

// Port allocator for WebRTC
let nextPort = config.streaming.portMin;

/**
 * Start a GStreamer streaming pipeline for a session.
 * Captures the Xvfb display, encodes with NVENC, and serves via WebRTC.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} displayNumber - Xvfb display number
 * @returns {{ port: number }}
 */
export async function startStream(sessionId, displayNumber) {
  const port = allocatePort();
  const display = `:${displayNumber}`;
  const resolution = config.streaming.resolution;
  const fps = config.streaming.fps;
  const bitrate = config.streaming.bitrate;
  const stunServer = config.streaming.stunServer;

  logger.info(`[streaming] Starting WebRTC Python streamer for session ${sessionId} | Display ${display}`);

  try {
    // Wait for Xvfb display to be ready (PCSX2 needs time to start rendering)
    await waitForDisplay(display, 10000);

    const pythonScript = '/app/scripts/webrtc_stream.py';
    const gstProcess = spawn('python3', [
      pythonScript,
      display,
      resolution,
      String(fps),
      String(bitrate),
      stunServer
    ], {
      env: {
        ...process.env,
        DISPLAY: display,
        XDG_RUNTIME_DIR: '/tmp/runtime-root',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    gstProcess.stderr.on('data', (data) => {
      logger.info(`[gst:${sessionId}] ${data.toString().trim()}`);
    });

    gstProcess.on('exit', (code) => {
      logger.info(`[streaming] Pipeline ${sessionId} exited with code ${code}`);
      activePipelines.delete(sessionId);
    });

    gstProcess.on('error', (err) => {
      logger.error(`[streaming] Pipeline ${sessionId} error:`, err);
    });

    activePipelines.set(sessionId, {
      process: gstProcess,
      port,
      displayNumber,
      io: null,
      socketId: null,
    });

    logger.info(`[streaming] ✓ WebRTC streamer started for session ${sessionId}`);

    return { port };
  } catch (error) {
    logger.error(`[streaming] Failed to start pipeline for ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Handle WebRTC Offer from client
 */
export function handleOffer(sessionId, sdp, socketId, io) {
  const pipeline = activePipelines.get(sessionId);
  if (!pipeline) return;

  pipeline.io = io;
  pipeline.socketId = socketId;

  // Set up stdout listener once offer arrives
  if (!pipeline.listening) {
    pipeline.listening = true;
    pipeline.process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line.trim());
          if (msg.type === 'answer' && pipeline.socketId) {
            logger.info(`[streaming] Emitting signal:answer for session ${sessionId} to ${pipeline.socketId}`);
            io.to(pipeline.socketId).emit('signal:answer', { sdp: msg.sdp });
          } else if (msg.type === 'ice' && pipeline.socketId) {
            io.to(pipeline.socketId).emit('signal:ice-candidate', { candidate: msg.candidate });
          }
        } catch {
          // ignore non-json logs
        }
      }
    });
  }

  // Send offer to python streamer via stdin
  pipeline.process.stdin.write(JSON.stringify({ type: 'offer', sdp }) + '\n');
}

/**
 * Handle ICE candidate from client
 */
export function handleIceCandidate(sessionId, candidate) {
  const pipeline = activePipelines.get(sessionId);
  if (!pipeline) return;
  pipeline.process.stdin.write(JSON.stringify({ type: 'ice', candidate }) + '\n');
}

/**
 * Stop the streaming pipeline for a session.
 */
export async function stopStream(sessionId) {
  const pipeline = activePipelines.get(sessionId);

  if (pipeline) {
    logger.info(`[streaming] Stopping pipeline for session ${sessionId}`);

    try {
      pipeline.process.kill('SIGINT');
      setTimeout(() => {
        try {
          pipeline.process.kill('SIGKILL');
        } catch {
          // Already dead
        }
      }, 3000);
    } catch {
      // Process already terminated
    }

    activePipelines.delete(sessionId);
  }
}

/**
 * Get info about all active streaming pipelines
 */
export function getActivePipelines() {
  const result = [];
  for (const [sessionId, info] of activePipelines) {
    result.push({
      sessionId,
      port: info.port,
      displayNumber: info.displayNumber,
    });
  }
  return result;
}

function allocatePort() {
  const port = nextPort;
  nextPort++;
  if (nextPort > config.streaming.portMax) {
    nextPort = config.streaming.portMin;
  }
  return port;
}

/**
 * Wait until an X display is ready by polling xdpyinfo.
 * @param {string} display - e.g. ":10"
 * @param {number} timeoutMs - max wait time
 */
async function waitForDisplay(display, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      execSync(`xdpyinfo -display ${display}`, { stdio: 'ignore', timeout: 2000 });
      logger.info(`[streaming] Display ${display} is ready`);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  logger.warn(`[streaming] Display ${display} not ready after ${timeoutMs}ms, proceeding anyway`);
}

export default { startStream, stopStream, getActivePipelines, handleOffer, handleIceCandidate };
