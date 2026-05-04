import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";
import { resolveTimeout } from "../core/timeouts";

/**
 * Execution Timeout AxisSensor - Intent-Based Deadline Enforcement
 *
 * Sets per-intent execution time limits and stores deadlines in the request
 * context. This prevents runaway handlers and ensures predictable response times.
 *
 * **Execution Order:** 210 (late, before handler execution)
 *
 * **Core Concept:**
 * Different intents have different acceptable latencies:
 * - Health checks: 2 seconds (must be fast)
 * - File uploads: 60 seconds (large transfers)
 * - Standard operations: 10 seconds (default)
 *
 * The sensor calculates a deadline timestamp and stores it in the context.
 * Handler code can check this deadline to abort if running too long.
 *
 * **How It Works:**
 * ```
 * 1. Look up timeout for intent (exact match or prefix pattern)
 * 2. Calculate deadline = now + timeout
 * 3. Store deadline in context
 * 4. Return ALLOW (enforcement happens in handler)
 * ```
 *
 * **Timeout Lookup:**
 * 1. Check exact intent match first
 * 2. Then check prefix patterns (e.g., 'file.*')
 * 3. Fall back to DEFAULT_TIMEOUT (10s)
 *
 * **Context Properties Set:**
 * - `deadline`: Absolute timestamp (ms since epoch)
 * - `timeoutMs`: Configured timeout duration
 *
 * **Handler Usage:**
 * ```typescript
 * if (ExecutionTimeoutSensor.isExpired(ctx)) {
 *   throw new Error('Execution timeout exceeded');
 * }
 *
 * const remaining = ExecutionTimeoutSensor.getRemainingMs(ctx);
 * ```
 *
 * **Security Model:**
 * - **Always Allow:** This sensor only sets context, doesn't block
 * - **Handler Responsibility:** Actual enforcement in handler code
 * - **Defense in Depth:** Works with ExecutionContractSensor
 *
 * **Actions:**
 * - `ALLOW` - Always (only sets context)
 *
 * **Performance:**
 * - Map lookup: O(1) to O(n patterns)
 * - Latency: <0.1ms
 *
 * @class ExecutionTimeoutSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 *
 * @example
 * File upload:
 * ```typescript
 * // Intent: file.upload
 * // Timeout: 60000ms
 * // ctx.deadline = Date.now() + 60000
 * { action: 'ALLOW' }
 * ```
 *
 * @example
 * Checking deadline in handler:
 * ```typescript
 * if (ExecutionTimeoutSensor.isExpired(ctx)) {
 *   throw new TimeoutError('Handler exceeded deadline');
 * }
 * ```
 *
 * @see {@link ExecutionContractSensor} - Resource limit enforcement
 */
@Sensor()
export class ExecutionTimeoutSensor implements AxisSensor {
  private readonly logger = { debug: (msg: string) => void 0 };

  /** AxisSensor identifier */
  readonly name = "ExecutionTimeoutSensor";

  /**
   * Execution order - late, near handler execution
   *
   * Order 210 ensures:
   * - All validation complete
   * - Deadline set just before handler
   */
  readonly order = BAND.BUSINESS + 10;

  /**
   * Determines if this sensor should process the given input.
   *
   * @param {SensorInput} input - Incoming request
   * @returns {boolean} True if intent is present
   */
  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(): boolean {
    return true;
  }

  /**
   * Sets execution deadline in the request context.
   *
   * **Processing Flow:**
   * 1. Look up timeout for intent
   * 2. Calculate absolute deadline
   * 3. Store in context for handler use
   * 4. Return ALLOW
   *
   * @param {SensorInput} input - Request with intent
   * @returns {Promise<SensorDecision>} Always ALLOW
   */
  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    const { intent, context } = input;
    if (!intent) {
      return { action: "ALLOW" };
    }

    // Get timeout for this intent
    const timeout = resolveTimeout(intent);

    // Calculate absolute deadline
    const deadline = Date.now() + timeout;

    // Store deadline in context for downstream components
    if (context) {
      (context as any).deadline = deadline;
      (context as any).timeoutMs = timeout;
    }

    this.logger.debug(
      `Set ${timeout}ms timeout for ${intent} (deadline: ${new Date(deadline).toISOString()})`,
    );

    // Actual timeout enforcement happens in the intent router/executor
    // This sensor just sets the deadline
    return { action: "ALLOW" };
  }

  /**
   * Checks if a deadline has been exceeded.
   *
   * Utility method for handler code.
   *
   * @static
   * @param {object} ctx - Context with deadline
   * @returns {boolean} True if deadline passed
   */
  static isExpired(ctx: { deadline?: number }): boolean {
    if (!ctx.deadline) return false;
    return Date.now() > ctx.deadline;
  }

  /**
   * Gets remaining time until deadline.
   *
   * Utility method for handler code.
   *
   * @static
   * @param {object} ctx - Context with deadline
   * @returns {number} Remaining milliseconds (0 if expired, Infinity if no deadline)
   */
  static getRemainingMs(ctx: { deadline?: number }): number {
    if (!ctx.deadline) return Infinity;
    return Math.max(0, ctx.deadline - Date.now());
  }
}
