/**
 * AXIS Proxy Configuration
 */

export interface ProxyConfig {
  /** Port to listen on */
  port: number;

  /** Backend AXIS server URL */
  backendUrl: string;

  /** Proxy mode: 'translate' | 'passthrough' | 'hybrid' */
  mode: 'translate' | 'passthrough' | 'hybrid';

  /** Enable request signing */
  signRequests: boolean;

  /** Private key for signing (hex) */
  signingKey?: string;

  /** Actor ID for proxy-initiated requests */
  proxyActorId?: string;

  /** Rate limit per IP (requests per minute) */
  rateLimitPerMinute: number;

  /** Enable debug logging */
  debug: boolean;

  /** Enable NestFlow auth routing and header forwarding */
  nestflowEnabled: boolean;

  /** Rate limit per IP for NestFlow auth intents (requests per minute) */
  nestflowAuthRateLimitPerMinute: number;
}

/**
 * Load configuration from environment
 */
export function loadConfig(): ProxyConfig {
  return {
    port: parseInt(process.env.AXIS_PROXY_PORT || '7777'),
    backendUrl:
      process.env.AXIS_BACKEND_URL || 'http://localhost:3000/api/axis',
    mode: (process.env.AXIS_PROXY_MODE as any) || 'hybrid',
    signRequests: process.env.AXIS_SIGN_REQUESTS === 'true',
    signingKey: process.env.AXIS_SIGNING_KEY,
    proxyActorId: process.env.AXIS_PROXY_ACTOR_ID,
    rateLimitPerMinute: parseInt(process.env.AXIS_RATE_LIMIT || '100'),
    debug: process.env.AXIS_DEBUG === 'true',
    nestflowEnabled: process.env.AXIS_NESTFLOW_ENABLED !== 'false',
    nestflowAuthRateLimitPerMinute: parseInt(
      process.env.AXIS_NESTFLOW_AUTH_RATE_LIMIT || '20',
    ),
  };
}
