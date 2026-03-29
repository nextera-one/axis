/**
 * Request Logger Middleware
 *
 * Structured logging for AXIS proxy requests with correlation IDs.
 */
import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';

import { metrics } from './metrics';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlationId: string;
  method: string;
  path: string;
  intent?: string;
  actorId?: string;
  statusCode?: number;
  durationMs?: number;
  bytesIn?: number;
  bytesOut?: number;
  clientIp: string;
  userAgent?: string;
  error?: string;
  message?: string;
  /** NestFlow: session identifier */
  sessionId?: string;
  /** NestFlow: device unique identifier */
  deviceUid?: string;
  /** NestFlow: intent category (auth, session, device, tickauth, identity) */
  intentCategory?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'pretty';
  includeHeaders: boolean;
  includeBody: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentConfig: LoggerConfig = {
  level: 'info',
  format: 'json',
  includeHeaders: false,
  includeBody: false,
};

/**
 * Configure logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Log a message
 */
export function log(
  level: LogLevel,
  message: string,
  data?: Partial<LogEntry>,
): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentConfig.level]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    correlationId: data?.correlationId || '-',
    method: data?.method || '-',
    path: data?.path || '-',
    clientIp: data?.clientIp || '-',
    message,
    ...data,
  };

  if (currentConfig.format === 'pretty') {
    const color = getColor(level);
    console.log(
      `${color}[${entry.timestamp}] ${level.toUpperCase().padEnd(5)} ${entry.correlationId.slice(0, 8)} ${entry.method} ${entry.path} ${message}\x1b[0m`,
    );
  } else {
    console.log(JSON.stringify(entry));
  }
}

function getColor(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return '\x1b[90m'; // Gray
    case 'info':
      return '\x1b[36m'; // Cyan
    case 'warn':
      return '\x1b[33m'; // Yellow
    case 'error':
      return '\x1b[31m'; // Red
    default:
      return '';
  }
}

/**
 * Request logging middleware
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Generate correlation ID
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      randomBytes(8).toString('hex');
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    const startTime = Date.now();
    const clientIp = getClientIp(req);

    // Log request start
    log('info', 'Request started', {
      correlationId,
      method: req.method,
      path: req.path,
      clientIp,
      userAgent: req.headers['user-agent'],
      intent:
        typeof req.params.intent === 'string'
          ? req.params.intent.replace(/\//g, '.')
          : ((req.params as any)[0] as string)?.replace(/\//g, '.'),
      actorId: req.headers['x-actor-id'] as string,
      sessionId: req.headers['x-session-id'] as string,
      deviceUid: req.headers['x-device-uid'] as string,
    });

    // Capture response
    const originalSend = res.send.bind(res);
    let responseBody: any;

    res.send = (body: any) => {
      responseBody = body;
      return originalSend(body);
    };

    // Log on response finish
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const bytesIn = parseInt(req.headers['content-length'] || '0');
      const bytesOut = parseInt(
        (res.getHeader('content-length') as string) || '0',
      );

      const level: LogLevel =
        res.statusCode >= 500
          ? 'error'
          : res.statusCode >= 400
            ? 'warn'
            : 'info';

      log(level, 'Request completed', {
        correlationId,
        method: req.method,
        path: req.path,
        intent:
          typeof req.params.intent === 'string'
            ? req.params.intent.replace(/\//g, '.')
            : ((req.params as any)[0] as string)?.replace(/\//g, '.'),
        actorId: req.headers['x-actor-id'] as string,
        statusCode: res.statusCode,
        durationMs,
        bytesIn,
        bytesOut,
        clientIp,
        sessionId: req.headers['x-session-id'] as string,
        deviceUid: req.headers['x-device-uid'] as string,
        intentCategory: getIntentCategory(
          typeof req.params.intent === 'string'
            ? req.params.intent.replace(/\//g, '.')
            : ((req.params as any)[0] as string)?.replace(/\//g, '.'),
        ),
      });

      // Record metrics
      const resolvedIntent =
        (typeof req.params.intent === 'string'
          ? req.params.intent.replace(/\//g, '.')
          : ((req.params as any)[0] as string)?.replace(/\//g, '.')) ||
        req.path;
      metrics.record({
        timestamp: Date.now(),
        intent: resolvedIntent,
        method: req.method,
        statusCode: res.statusCode,
        durationMs,
        bytesIn,
        bytesOut,
        clientIp,
        error: res.statusCode >= 400 ? responseBody?.error : undefined,
        intentCategory: getIntentCategory(resolvedIntent),
      });
    });

    next();
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Derive NestFlow intent category from intent name
 */
function getIntentCategory(intent: string | undefined): string | undefined {
  if (!intent) return undefined;
  const prefix = intent.split('.')[0];
  switch (prefix) {
    case 'auth':
      return 'auth';
    case 'session':
      return 'session';
    case 'device':
      return 'device';
    case 'tickauth':
      return 'tickauth';
    case 'identity':
      return 'identity';
    case 'capsule':
      return 'capsule';
    default:
      return undefined;
  }
}
