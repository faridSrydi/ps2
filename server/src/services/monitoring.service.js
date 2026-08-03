// ============================================================
// PS2 Cloud Gaming Platform — Monitoring Service
// Real-time system stats: CPU, GPU, RAM, Disk, etc.
// ============================================================

import os from 'os';
import { execSync } from 'child_process';
import logger from '../utils/logger.js';

/**
 * Get comprehensive system statistics.
 * Includes CPU, memory, GPU (NVIDIA), disk, and network info.
 *
 * @returns {object} System stats
 */
export async function getSystemStats() {
  const stats = {
    cpu: getCPUStats(),
    memory: getMemoryStats(),
    gpu: getGPUStats(),
    disk: getDiskStats(),
    uptime: os.uptime(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    timestamp: new Date().toISOString(),
  };

  return stats;
}

/**
 * CPU usage and info
 */
function getCPUStats() {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Calculate CPU usage percentage
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  const usagePercent = Math.round((1 - totalIdle / totalTick) * 100);

  return {
    model: cpus[0]?.model || 'Unknown',
    cores: cpus.length,
    usagePercent,
    loadAverage: {
      '1m': loadAvg[0]?.toFixed(2),
      '5m': loadAvg[1]?.toFixed(2),
      '15m': loadAvg[2]?.toFixed(2),
    },
  };
}

/**
 * Memory (RAM) usage
 */
function getMemoryStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    totalGB: (totalMem / (1024 ** 3)).toFixed(1),
    usedGB: (usedMem / (1024 ** 3)).toFixed(1),
    freeGB: (freeMem / (1024 ** 3)).toFixed(1),
    usagePercent: Math.round((usedMem / totalMem) * 100),
  };
}

/**
 * NVIDIA GPU stats via nvidia-smi
 * Returns null if nvidia-smi is not available
 */
function getGPUStats() {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,power.draw,encoder.stats.sessionCount --format=csv,noheader,nounits',
      { timeout: 5000, encoding: 'utf-8' }
    ).trim();

    const parts = output.split(',').map((s) => s.trim());

    return {
      name: parts[0],
      temperatureC: parseInt(parts[1]) || 0,
      utilizationPercent: parseInt(parts[2]) || 0,
      memoryUtilizationPercent: parseInt(parts[3]) || 0,
      vram: {
        totalMB: parseInt(parts[4]) || 0,
        usedMB: parseInt(parts[5]) || 0,
        freeMB: parseInt(parts[6]) || 0,
      },
      powerDrawW: parseFloat(parts[7]) || 0,
      encoderSessions: parseInt(parts[8]) || 0,
    };
  } catch {
    // nvidia-smi not available (development machine or no GPU)
    return null;
  }
}

/**
 * Disk usage stats
 */
function getDiskStats() {
  try {
    const output = execSync(
      "df -B1 --output=size,used,avail / | tail -1",
      { timeout: 5000, encoding: 'utf-8' }
    ).trim();

    const parts = output.split(/\s+/).map(Number);

    return {
      totalGB: (parts[0] / (1024 ** 3)).toFixed(1),
      usedGB: (parts[1] / (1024 ** 3)).toFixed(1),
      freeGB: (parts[2] / (1024 ** 3)).toFixed(1),
      usagePercent: Math.round((parts[1] / parts[0]) * 100),
    };
  } catch {
    return null;
  }
}

export default { getSystemStats };
