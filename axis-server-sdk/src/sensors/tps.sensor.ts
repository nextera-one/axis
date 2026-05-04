import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../sensor/axis-sensor";

/**
 * Configuration for the TPS Sensor.
 */
export interface TpsSensorOptions {
  /**
   * Maximum allowed clock drift in milliseconds between
   * the TPS coordinate timestamp and server time.
   * Defaults to 30_000 (30 seconds).
   */
  maxDriftMs?: number;

  /**
   * Optional function to resolve a TPS coordinate string
   * into a UTC epoch milliseconds value.
   * If not provided, the sensor parses i-notation directly.
   */
  resolver?: (tps: string) => number | null;
}

/** TPS epoch: 1999-08-11T07:00:00Z in milliseconds */
const TPS_EPOCH_MS = 934354800000;

/**
 * Parse a TPS i-notation coordinate (e.g. 'i858993459200.000')
 * into a UTC epoch milliseconds value.
 */
function parseINotation(tps: string): number | null {
  if (!tps.startsWith("i")) return null;
  const num = Number(tps.slice(1));
  if (!Number.isFinite(num)) return null;
  // i-notation is milliseconds since TPS epoch
  return TPS_EPOCH_MS + num;
}

/**
 * TPS Sensor — Temporal Positioning System time gate.
 *
 * Validates that the TPS coordinate attached to a request
 * is structurally valid and not excessively drifted from
 * the server's current time (guards against replay and
 * future-dated requests).
 *
 * Sensor rules:
 *   - If no TPS coordinate is present, the sensor allows (other sensors gate identity).
 *   - If the TPS coordinate is structurally invalid, DENY.
 *   - If the resolved timestamp drifts beyond maxDriftMs, DENY.
 */
@Sensor()
export class TpsSensor implements AxisSensor {
  readonly name = "TpsSensor";
  readonly order = BAND.POLICY + 2; // runs early in POLICY band, before Law

  private readonly maxDriftMs: number;
  private readonly resolver: (tps: string) => number | null;

  constructor(options: TpsSensorOptions = {}) {
    this.maxDriftMs = options.maxDriftMs ?? 30_000;
    this.resolver = options.resolver ?? parseINotation;
  }

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    // Only run when a TPS coordinate is present
    const tps =
      input.metadata?.tps_coordinate ??
      input.metadata?.tps ??
      input.packet?.tps;
    return typeof tps === "string" && tps.length > 0;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    const tps: string =
      input.metadata?.tps_coordinate ??
      input.metadata?.tps ??
      input.packet?.tps;

    // Resolve to UTC ms
    const resolved = this.resolver(tps);

    if (resolved === null) {
      return {
        allow: false,
        riskScore: 80,
        reasons: [`TPS coordinate '${tps}' is structurally invalid`],
        code: "TPS_INVALID_FORMAT",
      };
    }

    // Check drift
    const now = Date.now();
    const drift = Math.abs(now - resolved);

    if (drift > this.maxDriftMs) {
      const direction = resolved > now ? "future" : "past";
      return {
        allow: false,
        riskScore: 70,
        reasons: [
          `TPS drift ${drift}ms exceeds max ${this.maxDriftMs}ms (${direction})`,
        ],
        code: "TPS_DRIFT_EXCEEDED",
        tags: { tpsDriftMs: drift, tpsDirection: direction },
      };
    }

    return {
      allow: true,
      riskScore: 0,
      reasons: [],
      tags: {
        tpsResolved: resolved,
        tpsDriftMs: drift,
      },
    };
  }
}
