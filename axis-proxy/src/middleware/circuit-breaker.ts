/**
 * Circuit Breaker Middleware
 *
 * Protects the proxy from cascading failures by monitoring backend health
 * and temporarily stopping requests when the backend is unhealthy.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit */
  resetTimeout: number;
  /** Number of successful requests needed to close circuit */
  successThreshold: number;
  /** Timeout for individual requests in ms */
  requestTimeout: number;
  /** Custom failure detector */
  isFailure?: (error: any) => boolean;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      resetTimeout: config.resetTimeout || 30000, // 30 seconds
      successThreshold: config.successThreshold || 2,
      requestTimeout: config.requestTimeout || 30000,
      isFailure: config.isFailure || this.defaultIsFailure,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (
        Date.now() - (this.lastFailureTime || 0) >=
        this.config.resetTimeout
      ) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
        console.log('[CircuitBreaker] Transitioning to HALF_OPEN');
      } else {
        throw new CircuitOpenError('Circuit is OPEN - backend unavailable');
      }
    }

    try {
      // Add timeout wrapper
      const result = await this.withTimeout(fn(), this.config.requestTimeout);
      this.onSuccess();
      return result;
    } catch (error) {
      if (this.config.isFailure!(error)) {
        this.onFailure();
      }
      throw error;
    }
  }

  /**
   * Get current circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Force close the circuit (reset)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    console.log('[CircuitBreaker] Manually reset to CLOSED');
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Check for automatic transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (
        Date.now() - (this.lastFailureTime || 0) >=
        this.config.resetTimeout
      ) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      }
    }
    return this.state;
  }

  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        console.log('[CircuitBreaker] Transitioning to CLOSED');
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.log('[CircuitBreaker] Transitioning back to OPEN from HALF_OPEN');
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      console.log(
        `[CircuitBreaker] Transitioning to OPEN after ${this.failures} failures`,
      );
    }
  }

  private defaultIsFailure(error: any): boolean {
    // Network errors, timeouts, and 5xx responses are failures
    if (error instanceof CircuitOpenError) return false;
    if (error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.name === 'TimeoutError') return true;
    if (error.status >= 500) return true;
    return true;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          const error = new Error('Request timeout');
          error.name = 'TimeoutError';
          reject(error);
        }, ms);
      }),
    ]);
  }
}

/**
 * Custom error for circuit open state
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
