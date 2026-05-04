import type { NextFunction, Request, Response } from "express";
import {
  normalizeSensorDecision,
  RequiredProofKind,
  SENSOR_METADATA_KEY,
  SensorInput,
} from "@nextera.one/axis-server-sdk";

import { SensorRegistry } from "../sensor/sensor.registry";
import { wasRequestAborted } from "./request-lifecycle";

export interface AxisIntakeConfig {
  protocolMagic: Buffer;
  maxFrameSize: number;
  /** Body-level timeout. `0` disables the timeout. */
  bodyTimeoutMs: number;
}

export interface AxisIntakeTerminationInfo {
  statusCode: number;
  errorCode: string;
  message?: string;
}

export interface AxisIntakeHooks {
  /** Called when the request is aborted by the client before the body is complete. */
  onClientAbort?: () => void;
  /** Called when the response is closed mid-intake by the peer. */
  onResponseClosed?: () => void;
  /** Called on stream errors before the request is finalized. */
  onStreamError?: (err: Error) => void;
  /** Called before each rejection. */
  onIntakeRejection?: (info: AxisIntakeTerminationInfo) => void;
  /** Called when the full frame has been buffered successfully. */
  onFrameReceived?: (bytes: number) => void;
}

export interface CollectedFrame {
  body: Buffer;
  bytes: number;
}

export interface AxisIntakeController {
  finalize: (
    statusCode: number,
    body: string,
    destroyRequest?: boolean,
  ) => void;
  isTerminated: () => boolean;
}

/**
 * Stream-intake an AXIS binary frame with fail-fast magic validation and
 * max-frame-size enforcement.
 */
export function collectAxisFrame(
  req: Request,
  res: Response,
  config: AxisIntakeConfig,
  hooks: AxisIntakeHooks = {},
): {
  promise: Promise<CollectedFrame | null>;
  controller: AxisIntakeController;
} {
  // Fast-path for callers that already buffered the raw body.
  const preBuffered = (req as any).body;
  if (Buffer.isBuffer(preBuffered) && preBuffered.length > 0) {
    const body = preBuffered as Buffer;
    const bytes = body.length;
    hooks.onFrameReceived?.(bytes);
    let terminated = false;
    const noopFinalize = (statusCode: number, text: string) => {
      if (terminated || res.headersSent || res.writableEnded) return;
      terminated = true;
      res.status(statusCode).type("text/plain").send(text);
    };
    return {
      promise: Promise.resolve({ body, bytes }),
      controller: {
        finalize: noopFinalize,
        isTerminated: () => terminated,
      },
    };
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  let validated = false;
  let terminated = false;
  let resolveFn: (value: CollectedFrame | null) => void;

  const promise = new Promise<CollectedFrame | null>((resolve) => {
    resolveFn = resolve;
  });

  let onData: (chunk: Buffer) => void;
  let onEnd: () => void;
  let onAborted: () => void;
  let onReqClose: () => void;
  let onResClose: () => void;
  let onError: (err: Error) => void;

  const cleanup = () => {
    req.off("data", onData);
    req.off("end", onEnd);
    req.off("aborted", onAborted);
    req.off("close", onReqClose);
    req.off("error", onError);
    res.off("close", onResClose);
  };

  const finalize = (
    statusCode: number,
    body: string,
    destroyRequest: boolean = false,
  ) => {
    if (terminated || res.headersSent || res.writableEnded) return;
    terminated = true;
    cleanup();
    res.status(statusCode).type("text/plain").send(body);
    if (destroyRequest && !req.destroyed) {
      req.pause();
      req.destroy();
    }
    resolveFn(null);
  };

  const rejectWith = (
    statusCode: number,
    errorCode: string,
    body: string,
    destroyRequest: boolean,
    message?: string,
  ) => {
    hooks.onIntakeRejection?.({ statusCode, errorCode, message });
    finalize(statusCode, body, destroyRequest);
  };

  onAborted = () => {
    if (terminated) return;
    terminated = true;
    cleanup();
    hooks.onClientAbort?.();
    resolveFn(null);
  };

  onReqClose = () => {
    if (terminated) return;
    if (wasRequestAborted(req)) {
      terminated = true;
      cleanup();
      hooks.onClientAbort?.();
      resolveFn(null);
    }
  };

  onResClose = () => {
    if (terminated || res.writableEnded) return;
    terminated = true;
    cleanup();
    hooks.onResponseClosed?.();
    resolveFn(null);
  };

  onError = (err: Error) => {
    hooks.onStreamError?.(err);
    rejectWith(
      400,
      "STREAM_FAILURE",
      "AXIS_SEC_ERROR:STREAM_FAILURE",
      false,
      err.message,
    );
  };

  if (config.bodyTimeoutMs > 0) {
    req.setTimeout(config.bodyTimeoutMs, () => {
      rejectWith(408, "REQUEST_TIMEOUT", "AXIS_SEC_DENY:REQUEST_TIMEOUT", true);
    });
  }

  onData = (chunk: Buffer) => {
    if (terminated || wasRequestAborted(req) || res.writableEnded) return;
    receivedBytes += chunk.length;

    if (receivedBytes > config.maxFrameSize) {
      rejectWith(
        413,
        "PAYLOAD_TOO_LARGE",
        "AXIS_SEC_DENY:PAYLOAD_TOO_LARGE",
        true,
        `body too large (${receivedBytes} > ${config.maxFrameSize})`,
      );
      return;
    }

    if (!validated) {
      const currentBuffer =
        chunks.length > 0 ? Buffer.concat([...chunks, chunk]) : chunk;

      if (currentBuffer.length >= config.protocolMagic.length) {
        const magicCheck = validateAxisMagic(
          currentBuffer,
          config.protocolMagic,
        );
        if (!magicCheck.valid) {
          rejectWith(
            400,
            "INVALID_MAGIC",
            "AXIS_SEC_DENY:INVALID_MAGIC",
            true,
            `invalid magic ${magicCheck.actual}`,
          );
          return;
        }
        validated = true;
      }
    }

    chunks.push(chunk);
  };

  onEnd = () => {
    if (terminated || wasRequestAborted(req) || res.writableEnded) return;

    if (receivedBytes === 0) {
      rejectWith(400, "EMPTY_BODY", "AXIS_SEC_DENY:EMPTY_BODY", false);
      return;
    }

    const body = Buffer.concat(chunks);
    hooks.onFrameReceived?.(receivedBytes);
    cleanup();
    resolveFn({ body, bytes: receivedBytes });
  };

  req.on("data", onData);
  req.on("end", onEnd);
  req.on("aborted", onAborted);
  req.on("close", onReqClose);
  req.on("error", onError);
  res.on("close", onResClose);

  return {
    promise,
    controller: {
      finalize,
      isTerminated: () => terminated,
    },
  };
}

export interface AxisMagicValidation {
  valid: boolean;
  actual?: string;
}

export function validateAxisMagic(
  chunk: Uint8Array,
  expected: Uint8Array,
): AxisMagicValidation {
  if (chunk.length < expected.length) return { valid: true };
  const actual = chunk.subarray(0, expected.length);
  const valid = Buffer.from(actual).equals(Buffer.from(expected));
  return {
    valid,
    actual: valid ? undefined : new TextDecoder().decode(actual),
  };
}

export interface SensorEvaluation {
  sensorName: string;
  allow: boolean;
  riskScore: number;
  reasons: string[];
  durationMs: number;
}

export type PreDecodeResult =
  | { ok: true; accumulatedRisk: number }
  | {
      ok: false;
      sensorName: string;
      errorCode: string;
      statusCode: number;
      reasons: string[];
    };

export interface RunPreDecodeHooks {
  /** Invoked after each sensor runs for observation/logging. */
  onSensorEvaluated?: (evaluation: SensorEvaluation) => void;
}

/**
 * Iterate pre-decode sensors in registry order. Stops at the first DENY and
 * accumulates risk score onto `input.metadata.riskScore`.
 */
export async function runAxisPreDecodeSensors(
  registry: SensorRegistry,
  input: SensorInput,
  hooks: RunPreDecodeHooks = {},
): Promise<PreDecodeResult> {
  const preDecodeSensors = registry.getPreDecodeSensors();
  for (const sensor of preDecodeSensors) {
    const sensorMeta = Reflect.getMetadata(
      SENSOR_METADATA_KEY,
      sensor.constructor,
    );
    const excludeProofKinds = sensorMeta?.excludeProofKind
      ? [sensorMeta.excludeProofKind].flat()
      : [];

    const currentProofKinds =
      (input.metadata?.proofKind as RequiredProofKind[]) ?? [];
    if (
      excludeProofKinds.length > 0 &&
      currentProofKinds.some((kind) => excludeProofKinds.includes(kind))
    ) {
      continue;
    }

    if (sensor.supports && !sensor.supports(input)) continue;

    const sensorStart = Date.now();
    const rawDecision = await sensor.run(input);
    const decision = normalizeSensorDecision(rawDecision);
    const durationMs = Date.now() - sensorStart;

    hooks.onSensorEvaluated?.({
      sensorName: sensor.name,
      allow: decision.allow,
      riskScore: decision.riskScore,
      reasons: decision.reasons,
      durationMs,
    });

    if (!decision.allow) {
      const errorCode = decision.reasons[0] || "ACCESS_DENIED";
      return {
        ok: false,
        sensorName: sensor.name,
        errorCode,
        statusCode: mapAxisErrorCodeToStatus(errorCode),
        reasons: decision.reasons,
      };
    }

    if (!input.metadata) input.metadata = {};
    input.metadata.riskScore =
      (input.metadata.riskScore || 0) + decision.riskScore;
  }

  return { ok: true, accumulatedRisk: input.metadata?.riskScore || 0 };
}

export function mapAxisErrorCodeToStatus(code: string): number {
  switch (code) {
    case "INVALID_MAGIC":
    case "MALFORMED_HEADER":
    case "TRUNCATED_FRAME":
      return 400;
    case "PAYLOAD_TOO_LARGE":
      return 413;
    case "IP_BLOCKED":
    case "COUNTRY_BLOCKED":
      return 403;
    case "RATE_LIMIT":
      return 429;
    default:
      return 400;
  }
}

export type AxisIntakeNextFunction = NextFunction;
