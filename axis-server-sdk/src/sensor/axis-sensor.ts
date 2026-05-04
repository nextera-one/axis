import type { AxisObservedContext } from "../types/axis-frame.types";

/**
 * Sensor Phase Metadata
 *
 * Metadata describing which phase(s) a sensor executes in.
 * Used for validation and optimization.
 *
 * @interface SensorPhaseMetadata
 */
export interface SensorPhaseMetadata {
  /** Execution phase: pre-decode (middleware) or post-decode (controller) */
  phase: "PRE_DECODE" | "POST_DECODE";

  /** Other sensors that must run before this one */
  dependencies?: string[];

  /** Whether this sensor can perform async I/O */
  asyncOk?: boolean;

  /** Whether this sensor can use cryptographic operations */
  cryptoOk?: boolean;

  /** Human-readable description of sensor purpose */
  description?: string;
}

/**
 * AXIS Sensor Interface
 *
 * Core interface for all security sensors in the AXIS pipeline.
 */
export interface AxisSensor {
  readonly name: string;
  readonly order?: number; // Lower runs first
  /** Execution phase hint */
  phase?: SensorPhaseMetadata | "PRE_DECODE" | "POST_DECODE";
  /**
   * Synchronous applicability gate.
   *
   * Return `false` when the sensor does not apply to this input. The chain will
   * skip the sensor without recording a deny decision. Do not perform policy
   * decisions or async I/O here; put those in `run()`.
   */
  supports?(input: SensorInput): boolean;
  /**
   * Executes the sensor's actual check after `supports()` has passed.
   *
   * Return a SensorDecision to allow, deny, throttle, flag, or tighten the
   * request. This method may perform async work according to the sensor phase
   * and metadata.
   */
  run(input: SensorInput): Promise<SensorDecision>;
}

// Optional lifecycle hook for frameworks that support module initialization.
export interface AxisSensorInit extends AxisSensor {
  onModuleInit?(): void | Promise<void>;
}

/**
 * Sensors that run before frame decoding/deserialization.
 * They should be fast, avoid I/O, and fail fast on malformed traffic.
 */
export interface AxisPreSensor extends AxisSensor {
  phase: "PRE_DECODE";
}

/**
 * Sensors that run after a frame is fully decoded and parsed.
 * They may use full context (intent, actor, proofs) and can perform I/O.
 */
export interface AxisPostSensor extends AxisSensor {
  phase: "POST_DECODE";
}

/**
 * Sensor Input
 *
 * Represents the structured data passed to a security sensor for evaluation.
 * Depending on the execution phase, different fields may be populated.
 *
 * **Flow:**
 * - **Phase 1 (Pre-decode):** `rawBytes`, `ip`, `path`, and `peek` are typically available.
 * - **Phase 2/3 (Post-decode):** `intent`, `contentLength`, and `metadata` are populated after frame parsing.
 *
 * @interface SensorInput
 */
export interface SensorInput {
  /** The full raw binary frame from the wire (if available) */
  rawBytes?: Buffer | Uint8Array;

  /** The AXIS intent string extracted from the frame header (e.g., 'system.info') */
  intent?: string;

  /** IPv4/IPv6 address of the edge client */
  ip?: string;

  /** The HTTP or transport path being accessed */
  path?: string;

  /** Total size of the frame body in bytes */
  contentLength?: number;

  /** A small slice of the beginning of the body for early pattern matching */
  peek?: Uint8Array;

  /** Geolocation country code (if resolved by upstream middleware) */
  country?: string;

  /** Client identifier from the transport layer (e.g., Capsule ID or Socket ID) */
  clientId?: string;

  /** Whether the request is coming via a WebSocket connection */
  isWs?: boolean;

  /** Extensible metadata for cross-sensor communication */
  metadata?: Record<string, any>;

  /** Actor ID from frame or request */
  actorId?: string;

  /** Operation code */
  opcode?: string;

  /** Audience field */
  aud?: string;

  /** Observed context from frame parsing */
  observed?: AxisObservedContext;

  /** Parsed frame body */
  frameBody?: any;

  /** Device identifier */
  deviceId?: string;

  /** Session identifier */
  sessionId?: string;

  /** Parsed packet data */
  packet?: Record<string, any>;

  /** Dynamic field access for sensor-specific data */
  [key: string]: any;
}

export enum Decision {
  ALLOW = "ALLOW",
  DENY = "DENY",
  THROTTLE = "THROTTLE",
  FLAG = "FLAG",
}
/**
 * Sensor Decision
 *
 * Represents the outcome of an individual sensor's evaluation.
 * Supports two formats for backward compatibility:
 *
 * 1. Modern format (preferred): Uses decision/allow/riskScore/reasons
 * 2. Legacy format: Uses action/code/reason (deprecated, will be removed)
 */
export type SensorDecision =
  // Modern format (preferred)
  | {
      /** Final decision outcome (optional for backward compatibility) */
      decision?: Decision;
      /** Whether the request may continue immediately */
      allow: boolean;
      /** Risk score from 0–100 (0 = safe, 100 = blocked) */
      riskScore: number;
      /** Human & machine traceable reasons */
      reasons: string[];
      /** Machine-readable error or control code */
      code?: string;
      /** Throttle hint (only relevant for THROTTLE) */
      retryAfterMs?: number;
      /** Optional delta applied to rolling risk/anomaly state */
      scoreDelta?: number;
      /** Extra signals for audit, observability, forensics */
      tags?: Record<string, any>;
      /** Optional capsule / verification metadata */
      meta?: any;
      /** Optional constraint tightening instructions */
      tighten?: {
        expSecondsMax?: number;
        constraintsPatch?: Record<string, any>;
      };
    }
  // Legacy action-based format (deprecated)
  | { action: "ALLOW"; meta?: any }
  | {
      action: "DENY";
      code: string;
      reason?: string;
      retryAfterMs?: number;
      meta?: any;
    }
  | { action: "THROTTLE"; retryAfterMs: number; meta?: any }
  | { action: "FLAG"; scoreDelta: number; reasons: string[]; meta?: any };

export type SensorMinifiedDecision = {
  allow: boolean;
  riskScore: number;
  reasons: string[];
  tags?: Record<string, any>;
  meta?: any;
  tighten?: { expSecondsMax?: number; constraintsPatch?: Record<string, any> };
  /** Legacy fields for compatibility */
  retryAfterMs?: number;
};

/**
 * Helper to normalize SensorDecision (handles both legacy and modern formats)
 */
export function normalizeSensorDecision(
  sensorDecision: SensorDecision,
): SensorMinifiedDecision {
  // Check if it's a legacy action-based format
  if ("action" in sensorDecision) {
    // Convert legacy format to modern
    switch (sensorDecision.action) {
      case "ALLOW":
        return {
          allow: true,
          riskScore: 0,
          reasons: [],
          meta: sensorDecision.meta,
        };
      case "DENY":
        return {
          allow: false,
          riskScore: 100,
          reasons: [sensorDecision.code, sensorDecision.reason].filter(
            Boolean,
          ) as string[],
          meta: sensorDecision.meta,
          retryAfterMs: sensorDecision.retryAfterMs,
        };
      case "THROTTLE":
        return {
          allow: false,
          riskScore: 50,
          reasons: ["RATE_LIMIT"],
          retryAfterMs: sensorDecision.retryAfterMs,
          meta: sensorDecision.meta,
        };
      case "FLAG":
        return {
          allow: true,
          riskScore: sensorDecision.scoreDelta,
          reasons: sensorDecision.reasons,
          meta: sensorDecision.meta,
        };
    }
  }

  // Modern format - already has the required fields
  return {
    allow: sensorDecision.allow,
    riskScore: sensorDecision.riskScore,
    reasons: sensorDecision.reasons,
    tags: sensorDecision.tags,
    meta: sensorDecision.meta,
    tighten: sensorDecision.tighten,
    retryAfterMs: sensorDecision.retryAfterMs,
  };
}

/**
 * Helper factories for creating SensorDecision objects
 */
export const SensorDecisions = {
  allow(meta?: any, tags?: Record<string, any>): SensorDecision {
    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
      tags,
      meta,
    };
  },

  deny(code: string, reason?: string, meta?: any): SensorDecision {
    return {
      decision: Decision.DENY,
      allow: false,
      riskScore: 100,
      code,
      reasons: [code, reason].filter(Boolean) as string[],
      meta,
    };
  },

  throttle(retryAfterMs: number, meta?: any): SensorDecision {
    return {
      decision: Decision.THROTTLE,
      allow: false,
      riskScore: 50,
      retryAfterMs,
      code: "RATE_LIMIT",
      reasons: ["RATE_LIMIT"],
      meta,
    };
  },

  flag(scoreDelta: number, reasons: string[], meta?: any): SensorDecision {
    return {
      decision: Decision.FLAG,
      allow: true,
      riskScore: scoreDelta,
      scoreDelta,
      reasons,
      meta,
    };
  },
};
