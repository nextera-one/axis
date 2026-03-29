/**
 * CORS Middleware
 *
 * Cross-Origin Resource Sharing configuration for AXIS proxy.
 */
import { NextFunction, Request, Response } from 'express';

export interface CorsConfig {
  /** Allowed origins (string, array, or '*' for all) */
  origin: string | string[] | '*';
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Headers to expose to client */
  exposedHeaders: string[];
  /** Allow credentials */
  credentials: boolean;
  /** Preflight cache max age in seconds */
  maxAge: number;
}

const defaultConfig: CorsConfig = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Actor-Id',
    'X-Proof-Type',
    'X-Capsule-Id',
    'X-Correlation-Id',
    'X-Request-Id',
    'X-Session-Id',
    'X-Device-Uid',
    'X-Auth-Level',
    'X-Kid',
  ],
  exposedHeaders: [
    'X-Correlation-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Session-Id',
    'X-Auth-Level',
    'X-Device-Uid',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Create CORS middleware
 */
export function cors(config: Partial<CorsConfig> = {}) {
  const cfg: CorsConfig = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Determine if origin is allowed
    let allowOrigin = '*';
    if (cfg.origin === '*') {
      allowOrigin = '*';
    } else if (Array.isArray(cfg.origin)) {
      if (origin && cfg.origin.includes(origin)) {
        allowOrigin = origin;
      } else {
        allowOrigin = cfg.origin[0];
      }
    } else if (typeof cfg.origin === 'string') {
      allowOrigin = cfg.origin;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', cfg.methods.join(', '));
    res.setHeader(
      'Access-Control-Allow-Headers',
      cfg.allowedHeaders.join(', '),
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      cfg.exposedHeaders.join(', '),
    );
    res.setHeader('Access-Control-Max-Age', cfg.maxAge.toString());

    if (cfg.credentials && allowOrigin !== '*') {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Load CORS config from environment
 */
export function loadCorsConfig(): Partial<CorsConfig> {
  const origin = process.env.CORS_ORIGIN;
  const methods = process.env.CORS_METHODS;

  return {
    origin:
      origin === '*' ? '*' : origin?.split(',').map((o) => o.trim()) || '*',
    methods: methods?.split(',').map((m) => m.trim()) || defaultConfig.methods,
  };
}
