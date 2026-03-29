/**
 * Rate Limiter Middleware
 *
 * Simple in-memory rate limiter using sliding window algorithm.
 * For production, consider using Redis for distributed rate limiting.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Custom key extractor (default: IP address) */
  keyExtractor?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom handler when rate limit is exceeded */
  handler?: (req: Request, res: Response) => void;
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimiterConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      maxRequests: config.maxRequests || 100,
      windowMs: config.windowMs || 60000, // 1 minute default
      keyExtractor: config.keyExtractor || this.defaultKeyExtractor,
      skip: config.skip,
      handler: config.handler || this.defaultHandler,
    };

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Express middleware function
   */
  middleware = (req: Request, res: Response, next: NextFunction): void => {
    // Check if we should skip this request
    if (this.config.skip && this.config.skip(req)) {
      return next();
    }

    const key = this.config.keyExtractor!(req);
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart > this.config.windowMs) {
      // New window
      this.store.set(key, { count: 1, windowStart: now });
      this.setHeaders(
        res,
        this.config.maxRequests - 1,
        now + this.config.windowMs,
      );
      return next();
    }

    entry.count++;

    if (entry.count > this.config.maxRequests) {
      // Rate limit exceeded
      this.setHeaders(res, 0, entry.windowStart + this.config.windowMs);
      return this.config.handler!(req, res);
    }

    this.setHeaders(
      res,
      this.config.maxRequests - entry.count,
      entry.windowStart + this.config.windowMs,
    );
    next();
  };

  /**
   * Get current stats for a key
   */
  getStats(key: string): { remaining: number; resetAt: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    return {
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetAt: entry.windowStart + this.config.windowMs,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Destroy the rate limiter (cleanup interval)
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  private defaultKeyExtractor(req: Request): string {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private defaultHandler(_req: Request, res: Response): void {
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil(this.config.windowMs / 1000),
    });
  }

  private setHeaders(res: Response, remaining: number, resetAt: number): void {
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > this.config.windowMs) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Create rate limiter middleware with default config
 */
export function createRateLimiter(requestsPerMinute: number = 100) {
  return new RateLimiter({
    maxRequests: requestsPerMinute,
    windowMs: 60000,
  });
}
