// ============================================================
// PS2 Cloud Gaming Platform — Streaming Service
// GStreamer pipeline for screen capture → NVENC → WebRTC
// ============================================================

import { spawn } from 'child_process';
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
  const [width, height] = config.streaming.resolution.split('x');

  logger.info(`[streaming] Starting pipeline for session ${sessionId} | Display ${display} | Port ${port}`);

  // Check if NVENC (NVIDIA hardware encoder) is available, fallback to x264enc (software)
  let videoEncoder = `! x264enc tune=zerolatency bitrate=${config.streaming.bitrate} speed-preset=ultrafast key-int-max=30`;
  try {
    const { execSync } = await import('child_process');
    execSync('gst-inspect-1.0 nvh264enc', { stdio: 'ignore' });
    videoEncoder = [
      `! nvh264enc`,
      `  bitrate=${config.streaming.bitrate}`,
      `  preset=low-latency-hq`,
      `  rc-mode=cbr`,
      `  zerolatency=true`,
      `  gop-size=30`,
    ].join(' ');
    logger.info('[streaming] Using NVIDIA NVENC hardware encoder');
  } catch {
    logger.info('[streaming] NVIDIA NVENC not found, using x264enc software encoder');
  }

  // GStreamer pipeline command
  // Captures X11 display → scales → encodes → outputs via WebRTC
  const pipelineDesc = [
    // Video capture from Xvfb
    `ximagesrc display-name=${display} use-damage=false show-pointer=false`,
    `! video/x-raw,framerate=${config.streaming.fps}/1`,
    `! videoconvert`,
    `! videoscale`,
    `! video/x-raw,width=${width},height=${height}`,

    // Video encoder (NVENC or x264enc)
    videoEncoder,

    // RTP payload
    `! rtph264pay config-interval=-1 pt=96`,

    // Audio capture (PulseAudio with fallback to silence)
    `pulsesrc`,
    `! audioconvert`,
    `! audioresample`,
    `! opusenc bitrate=128000 frame-size=10`,
    `! rtpopuspay pt=97`,

    // WebRTC output
    `webrtcbin name=webrtc bundle-policy=max-bundle`,
    `  stun-server=${config.streaming.stunServer}`,
  ].join(' ');

  try {
    const gstProcess = spawn('gst-launch-1.0', ['-v', '-e', pipelineDesc], {
      env: {
        ...process.env,
        DISPLAY: display,
        GST_DEBUG: '2',  // Minimal debug output
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    gstProcess.stdout.on('data', (data) => {
      logger.debug(`[gst:${sessionId}] ${data.toString().trim()}`);
    });

    gstProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      // Filter out noisy GStreamer debug messages
      if (!msg.includes('DEBUG') && !msg.includes('LOG')) {
        logger.debug(`[gst:${sessionId}] ${msg}`);
      }
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
    });

    logger.info(`[streaming] ✓ Pipeline started for session ${sessionId}`);

    return { port };
  } catch (error) {
    logger.error(`[streaming] Failed to start pipeline for ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Stop the streaming pipeline for a session.
 *
 * @param {string} sessionId - Session UUID
 */
export async function stopStream(sessionId) {
  const pipeline = activePipelines.get(sessionId);

  if (pipeline) {
    logger.info(`[streaming] Stopping pipeline for session ${sessionId}`);

    try {
      // Send EOS (End of Stream) signal for graceful shutdown
      pipeline.process.kill('SIGINT');

      // Force kill after 3 seconds
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

/**
 * Allocate a port from the WebRTC port range
 */
function allocatePort() {
  const port = nextPort;
  nextPort++;

  // Wrap around if we exceed max
  if (nextPort > config.streaming.portMax) {
    nextPort = config.streaming.portMin;
  }

  return port;
}

export default { startStream, stopStream, getActivePipelines };
