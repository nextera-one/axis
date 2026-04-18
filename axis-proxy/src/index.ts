/**
 * AXIS Proxy - Main Entry Point
 *
 * A high-performance protocol gateway that translates REST requests to AXIS binary protocol.
 *
 * Features:
 * - REST → AXIS binary translation
 * - AXIS binary → JSON response translation
 * - Request signing (optional)
 * - Rate limiting at edge
 * - Circuit breaker for backend resilience
 * - Prometheus-compatible metrics
 * - Structured logging with correlation IDs
 * - CORS support
 * - Health monitoring
 */
import express, { NextFunction, Request, Response } from 'express';
import * as dotenv from 'dotenv';
import helmet from 'helmet';

import { AxisTranslator } from './translator';
import { AxisMediaTypes } from './axis-media-types';
import { loadConfig, ProxyConfig } from './config';

dotenv.config();
import {
  RateLimiter,
  CircuitBreaker,
  CircuitOpenError,
  metrics,
  requestLogger,
  configureLogger,
  log,
  cors,
  loadCorsConfig,
} from './middleware';

const app = express();
const config = loadConfig();

// Configure logger
configureLogger({
  level: config.debug ? 'debug' : 'info',
  format: config.debug ? 'pretty' : 'json',
});

// Initialize middleware
const rateLimiter = new RateLimiter({
  maxRequests: config.rateLimitPerMinute,
  windowMs: 60000,
  skip: (req) => req.path === '/health' || req.path === '/metrics',
});

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  requestTimeout: parseInt(process.env.AXIS_REQUEST_TIMEOUT_MS || '30000'),
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API proxy
  }),
);

// CORS
app.use(cors(loadCorsConfig()));

// Request logging
app.use(requestLogger());

// Rate limiting
app.use(rateLimiter.middleware);

// Parse JSON for REST requests
app.use(express.json({ limit: '1mb' }));

// Parse raw binary for AXIS passthrough
app.use(
  express.raw({
    type: [AxisMediaTypes.BINARY, AxisMediaTypes.OCTET_STREAM],
    limit: '70kb', // AXIS max frame size
  }),
);

// Create translator
const translator = new AxisTranslator(config, circuitBreaker);

// ═══════════════════════════════════════════════════════════════
// Health & Monitoring Endpoints
// ═══════════════════════════════════════════════════════════════

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  const circuitState = circuitBreaker.getState();
  const isHealthy = circuitState !== 'OPEN';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'axis-proxy',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    circuit: circuitState,
    uptime: process.uptime(),
  });
});

/**
 * Readiness check (for Kubernetes)
 */
app.get('/ready', (_req, res) => {
  const circuitState = circuitBreaker.getState();
  if (circuitState === 'OPEN') {
    res.status(503).json({
      ready: false,
      reason: 'Backend unavailable',
      circuit: circuitState,
    });
  } else {
    res.json({ ready: true });
  }
});

/**
 * Liveness check (for Kubernetes)
 */
app.get('/live', (_req, res) => {
  res.json({ live: true });
});

/**
 * Proxy info endpoint
 */
app.get('/info', (_req, res) => {
  res.json({
    name: '@nextera.one/axis-proxy',
    version: '2.1.0',
    backend: config.backendUrl,
    mode: config.mode,
    features: {
      rateLimiting: true,
      circuitBreaker: true,
      metrics: true,
      cors: true,
      nestflow: config.nestflowEnabled,
    },
    circuit: circuitBreaker.getStats(),
  });
});

/**
 * Metrics endpoint (Prometheus format)
 */
app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.getPrometheusMetrics());
});

/**
 * Metrics endpoint (JSON format)
 */
app.get('/metrics/json', (_req, res) => {
  const windowMs = parseInt((_req.query.window as string) || '60000');
  res.json(metrics.getSummary(windowMs));
});

/**
 * Recent requests (for debugging)
 */
app.get('/debug/requests', (_req, res) => {
  if (!config.debug) {
    return res.status(403).json({ error: 'Debug mode not enabled' });
  }
  const limit = parseInt((_req.query.limit as string) || '100');
  res.json(metrics.getRecentRequests(limit));
});

/**
 * Circuit breaker control
 */
app.post('/admin/circuit/reset', (_req, res) => {
  circuitBreaker.reset();
  log('warn', 'Circuit breaker manually reset', {
    correlationId: (_req as any).correlationId,
    method: 'POST',
    path: '/admin/circuit/reset',
    clientIp: _req.ip || 'unknown',
  });
  res.json({ success: true, state: circuitBreaker.getState() });
});

// ═══════════════════════════════════════════════════════════════
// AXIS Protocol Endpoints
// ═══════════════════════════════════════════════════════════════

/**
 * REST → AXIS Translation Endpoint
 *
 * POST /api/:intent
 * Body: JSON object
 * Headers:
 *   - X-Actor-Id: Actor ID (required)
 *   - X-Proof-Type: Proof type (optional, default: 0)
 *   - X-Capsule-Id: Capsule ID for proof (optional)
 */
app.use('/api', async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Method must be POST',
      correlationId: (req as any).correlationId,
    });
  }

  try {
    const intent = req.path.replace(/^\//, '').replace(/\//g, '.');
    const actorId = req.headers['x-actor-id'] as string;
    const proofType = parseInt(req.headers['x-proof-type'] as string) || 0;
    const capsuleId = req.headers['x-capsule-id'] as string;

    // NestFlow headers
    const sessionId = req.headers['x-session-id'] as string | undefined;
    const deviceUid = req.headers['x-device-uid'] as string | undefined;
    const identityUid = req.headers['x-identity-uid'] as string | undefined;
    const authLevel = req.headers['x-auth-level'] as string | undefined;
    const kid = req.headers['x-kid'] as string | undefined;
    const requestedTrust = req.headers['x-requested-trust'] as
      | 'ephemeral_session'
      | 'trusted_device'
      | undefined;
    const tpsCoordinate = req.headers['x-tps-coordinate'] as string | undefined;
    const challengeUid = req.headers['x-challenge-uid'] as string | undefined;
    const browserPublicKey = req.headers['x-browser-public-key'] as
      | string
      | undefined;
    const browserKeyAlgorithm = req.headers['x-browser-key-algorithm'] as
      | string
      | undefined;
    const browserProofSignature = req.headers['x-browser-proof-signature'] as
      | string
      | undefined;
    const mobileDeviceUid = req.headers['x-mobile-device-uid'] as
      | string
      | undefined;

    if (!actorId) {
      return res.status(400).json({
        error: 'MISSING_ACTOR_ID',
        message: 'X-Actor-Id header is required',
        correlationId: (req as any).correlationId,
      });
    }

    // Validate actor ID format (should be hex)
    if (!/^[0-9a-fA-F]+$/.test(actorId.replace('0x', ''))) {
      return res.status(400).json({
        error: 'INVALID_ACTOR_ID',
        message: 'X-Actor-Id must be a valid hex string',
        correlationId: (req as any).correlationId,
      });
    }

    if (
      requestedTrust &&
      requestedTrust !== 'ephemeral_session' &&
      requestedTrust !== 'trusted_device'
    ) {
      return res.status(400).json({
        error: 'INVALID_REQUESTED_TRUST',
        message:
          'X-Requested-Trust must be ephemeral_session or trusted_device',
        correlationId: (req as any).correlationId,
      });
    }

    // Translate REST to AXIS and forward
    const bodyAugment: Record<string, unknown> = {};
    if (challengeUid) bodyAugment.challengeUid = challengeUid;
    if (browserPublicKey) bodyAugment.browserPublicKey = browserPublicKey;
    if (browserKeyAlgorithm)
      bodyAugment.browserKeyAlgorithm = browserKeyAlgorithm;
    if (browserProofSignature)
      bodyAugment.browserProofSignature = browserProofSignature;
    if (mobileDeviceUid) bodyAugment.mobileDeviceUid = mobileDeviceUid;

    const result = await translator.translateAndForward({
      intent,
      actorId,
      proofType,
      capsuleId,
      body: req.body,
      ip: req.ip || '0.0.0.0',
      correlationId: (req as any).correlationId,
      sessionId,
      deviceUid,
      identityUid,
      authLevel,
      kid,
      requestedTrust,
      tpsCoordinate,
      bodyAugment,
    });

    // Return translated response
    res.status(result.statusCode).json({
      ...result.body,
      correlationId: (req as any).correlationId,
    });
  } catch (error: any) {
    handleError(error, req, res);
  }
});

/**
 * AXIS Binary Passthrough
 *
 * POST /axis
 * Body: Raw AXIS binary frame
 *
 * For clients that already speak AXIS binary
 */
app.post('/axis', async (req: Request, res: Response) => {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        error: 'INVALID_BODY',
        message: 'Expected raw binary body',
        correlationId: (req as any).correlationId,
      });
    }

    // Forward binary directly to backend
    const result = await translator.forwardBinary(
      req.body,
      req.ip || '0.0.0.0',
      (req as any).correlationId,
    );

    if (Buffer.isBuffer(result.body)) {
      res.status(result.statusCode);
      res.set('Content-Type', AxisMediaTypes.BINARY);
      res.send(result.body);
    } else {
      res.status(result.statusCode).json(result.body);
    }
  } catch (error: any) {
    handleError(error, req, res);
  }
});

// ═══════════════════════════════════════════════════════════════
// Error Handling
// ═══════════════════════════════════════════════════════════════

/**
 * Central error handler
 */
function handleError(error: any, req: Request, res: Response): void {
  const correlationId = (req as any).correlationId;

  if (error instanceof CircuitOpenError) {
    log('warn', 'Circuit breaker open', {
      correlationId,
      method: req.method,
      path: req.path,
      clientIp: req.ip || 'unknown',
      error: error.message,
    });

    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Backend temporarily unavailable, please retry later',
      correlationId,
      retryAfter: 30,
    });
    return;
  }

  log('error', `Request failed: ${error.message}`, {
    correlationId,
    method: req.method,
    path: req.path,
    clientIp: req.ip || 'unknown',
    error: error.message,
  });

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: config.debug ? error.message : 'An internal error occurred',
    correlationId,
  });
}

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    correlationId: (_req as any).correlationId,
  });
});

/**
 * Global error handler
 */
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  handleError(error, req, res);
});

// ═══════════════════════════════════════════════════════════════
// Server Startup
// ═══════════════════════════════════════════════════════════════

const PORT = config.port || 7777;

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                       AXIS PROXY v2.1                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:         RUNNING                                      ║
║  Port:           ${PORT.toString().padEnd(45)}║
║  Backend:        ${config.backendUrl.padEnd(45)}║
║  Mode:           ${config.mode.padEnd(45)}║
║  Rate Limit:     ${(config.rateLimitPerMinute + ' req/min').padEnd(45)}║
║  NestFlow:       ${(config.nestflowEnabled ? 'enabled' : 'disabled').padEnd(45)}║
║  Debug:          ${(config.debug ? 'enabled' : 'disabled').padEnd(45)}║
╚═══════════════════════════════════════════════════════════════╝
  `);
  console.log('Endpoints:');
  console.log('  GET  /health           - Health check');
  console.log('  GET  /ready            - Readiness probe (K8s)');
  console.log('  GET  /live             - Liveness probe (K8s)');
  console.log('  GET  /info             - Proxy info');
  console.log('  GET  /metrics          - Prometheus metrics');
  console.log('  GET  /metrics/json     - JSON metrics');
  console.log('  POST /api/:intent      - REST → AXIS translation');
  console.log('  POST /axis             - Binary passthrough');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down gracefully', {
    correlationId: 'shutdown',
    method: '-',
    path: '-',
    clientIp: '-',
  });

  server.close(() => {
    rateLimiter.destroy();
    metrics.destroy();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down gracefully', {
    correlationId: 'shutdown',
    method: '-',
    path: '-',
    clientIp: '-',
  });

  server.close(() => {
    rateLimiter.destroy();
    metrics.destroy();
    process.exit(0);
  });
});

export { app, server };
