// ============================================================
// PS2 Cloud Gaming Platform — Logger (Winston)
// Structured logging with daily rotation
// ============================================================

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config/env.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${stack || message}${metaStr}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  defaultMeta: { service: 'ps2-cloud' },
  transports: [
    // Console output (colorized in development)
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    }),

    // Daily rotating file — all logs
    new DailyRotateFile({
      filename: `${config.paths.logs}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
    }),

    // Daily rotating file — errors only
    new DailyRotateFile({
      filename: `${config.paths.logs}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
  // Don't exit on uncaught errors
  exitOnError: false,
});

export default logger;
