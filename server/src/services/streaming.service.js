// ============================================================
// PS2 Cloud Gaming Platform — Streaming Service
// GStreamer pipeline for screen capture → NVENC → WebRTC
// ============================================================

import { spawn, execSync } from 'child_process';
import config from '../config/env.js';
import logger from '../utils/logger.js';

// Track active streaming pipelines: sessionId → { process, port, io }
const activePipelines = new Map();

// Port allocator for WebRTC
let nextPort = config.streaming.portMin;

/**
 * Start a GStreamer streaming pipeline for a session.
 *
 * @param {string} sessionId - Session UUID
 * @param {number} displayNumber - Xvfb display number
 * @param {object} io - Socket.io Instance
 * @returns {{ port: number }}
 */
export async function startStream(sessionId, displayNumber, io) {
  const port = allocatePort();
  const display = `:${displayNumber}`;
  const resolution = config.streaming.resolution;
  const fps = config.streaming.fps;
  const bitrate = config.streaming.bitrate;
  const stunServer = config.streaming.stunServer;

  logger.info(`[streaming] Starting WebRTC Python streamer for session ${sessionId} | Display ${display}`);

  try {
    // Wait for Xvfb display to be ready
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

    activePipelines.set(sessionId, {
      process: gstProcess,
      port,
      displayNumber,
      io,
    });

    // 1. TANGKAP STDOUT DARI PYTHON STREAMER (FIXED: gstProcess.stdout)
    gstProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line.trim());
          
          // Python ngirim OFFER -> Forward ke Browser Client
          if (msg.type === 'offer') {
            logger.info(`[streaming] SDP Offer received from Python for session ${sessionId}`);
            io.to(`session:${sessionId}`).emit('signal:offer', { sdp: msg.sdp });
          } 
          // Python ngirim ICE Candidate -> Forward ke Browser Client
          else if (msg.type === 'ice') {
            logger.info(`[streaming] ICE candidate received from Python for session ${sessionId}`);
            io.to(`session:${sessionId}`).emit('signal:ice-candidate', { candidate: msg.candidate });
          }
        } catch {
          // Abaikan log biasa dari GStreamer
        }
      }
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

    logger.info(`[streaming] ✓ WebRTC streamer started for session ${sessionId}`);
    return { port };

  } catch (error) {
    logger.error(`[streaming] Failed to start pipeline for ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Handle WebRTC Offer from browser client -> Send to Python STDIN
 */
export function handleOffer(sessionId, sdp) {
  logger.info(`[streaming] Offer received from Browser for session ${sessionId}`);
  const pipeline = activePipelines.get(sessionId);
  if (!pipeline) return;

  const payload = JSON.stringify({ type: 'offer', sdp }) + '\n';
  pipeline.process.stdin.write(payload);
  logger.info(`[streaming] Offer forwarded to Python STDIN for session ${sessionId}`);
}

/**
 * Handle WebRTC Answer from browser client -> Send to Python STDIN
 */
export function handleAnswer(sessionId, sdp) {
  logger.info(`[streaming] Answer received from Browser for session ${sessionId}`);
  const pipeline = activePipelines.get(sessionId);
  if (!pipeline) return;

  const payload = JSON.stringify({ type: 'answer', sdp }) + '\n';
  pipeline.process.stdin.write(payload);
  logger.info(`[streaming] Answer forwarded to Python STDIN for session ${sessionId}`);
}

/**
 * Handle ICE candidate from browser client -> Send to Python STDIN
 */
export function handleIceCandidate(sessionId, candidate) {
  logger.info(`[streaming] ICE received from Browser for session ${sessionId}`);
  const pipeline = activePipelines.get(sessionId);
  if (!pipeline) return;

  const payload = JSON.stringify({ type: 'ice', candidate }) + '\n';
  pipeline.process.stdin.write(payload);
  logger.info(`[streaming] ICE candidate forwarded to Python STDIN for session ${sessionId}`);
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
        try { pipeline.process.kill('SIGKILL'); } catch {}
      }, 3000);
    } catch {}
    activePipelines.delete(sessionId);
  }
}

export function isStreamActive(sessionId) {
  return activePipelines.has(sessionId);
}

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

export default { startStream, stopStream, getActivePipelines, handleAnswer, handleIceCandidate, isStreamActive };
