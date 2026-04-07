import { buildExecutionContext, type CceDerivationInput } from "./cce-derivation.service";
import { buildCceErrorResponse, buildCceResponse, type CceAxisSigner, type CceClientKeyEncryptor } from "./cce-response.service";
import { buildWitnessRecord, type CceWitnessStore, extractVerificationState } from "./cce-witness.observer";
import type { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";
import { normalizeSensorDecision } from "../sensor/axis-sensor";
/**
 * CCE Pipeline Orchestrator
 *
 * Orchestrates the full CCE request/response lifecycle within AXIS:
 *
 * Request path:
 *  1. Parse envelope
 *  2. Run sensor chain (7 CCE sensors in order)
 *  3. Derive execution context
 *  4. Route to handler
 *  5. Execute handler
 *
 * Response path:
 *  6. Encrypt response
 *  7. Sign response
 *  8. Record witness
 *  9. Return response
 *
 * This orchestrator can be integrated into IntentRouter or used standalone.
 */
import { CCE_ERROR, CCE_PROTOCOL_VERSION, type CceCapsuleClaims, CceError, type CceExecutionContext, type CceRequestEnvelope, type CceResponseEnvelope, type CceResponseStatus } from "./cce.types";

/**
 * CCE handler function — receives decrypted payload and execution context.
 */
export type CceHandler = (
  payload: Uint8Array,
  context: CceHandlerContext,
) => Promise<CceHandlerResult>;

export interface CceHandlerContext {
  /** Verified capsule claims */
  capsule: CceCapsuleClaims;
  /** Derived execution context */
  executionContext: CceExecutionContext;
  /** Original request envelope */
  envelope: CceRequestEnvelope;
  /** Client's verified public key */
  clientPublicKeyHex: string;
  /** Request intent */
  intent: string;
  /** Actor identity */
  sub: string;
}

export interface CceHandlerResult {
  status: CceResponseStatus;
  body: Uint8Array;
  effect?: string;
}

/**
 * CCE Pipeline Configuration
 */
export interface CcePipelineConfig {
  /** AXIS local secret for key derivation (hex) */
  axisLocalSecret: string;
  /** AXIS audience identifier */
  axisAudience: string;
  /** CCE sensors (will be sorted by order) */
  sensors: AxisSensor[];
  /** Intent → handler mapping */
  handlers: Map<string, CceHandler>;
  /** Witness store */
  witnessStore: CceWitnessStore;
  /** Client key encryptor (for response encryption) */
  clientKeyEncryptor: CceClientKeyEncryptor;
  /** AXIS response signer */
  axisSigner: CceAxisSigner;
}

/**
 * Result of CCE pipeline execution.
 */
export type CcePipelineResult =
  | { ok: true; response: CceResponseEnvelope; witnessId: string }
  | {
      ok: false;
      error: { code: string; message: string };
      status: CceResponseStatus;
    };

/**
 * Execute the full CCE pipeline.
 */
export async function executeCcePipeline(
  envelope: CceRequestEnvelope,
  config: CcePipelineConfig,
): Promise<CcePipelineResult> {
  const startTime = Date.now();

  // Validate protocol version
  if (envelope.ver !== CCE_PROTOCOL_VERSION) {
    return {
      ok: false,
      error: {
        code: CCE_ERROR.UNSUPPORTED_VERSION,
        message: `Unsupported version: ${envelope.ver}`,
      },
      status: "ERROR",
    };
  }

  // Build sensor input
  const sensorInput: SensorInput = {
    intent: envelope.capsule.intent,
    metadata: {
      cce: true,
      cceEnvelope: envelope,
      contentType: "application/axis-cce",
    },
  };

  // Run sensor chain in order
  const sortedSensors = [...config.sensors].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999),
  );

  for (const sensor of sortedSensors) {
    if (sensor.supports && !sensor.supports(sensorInput)) {
      continue;
    }

    let decision: SensorDecision;
    try {
      decision = await sensor.run(sensorInput);
    } catch (err) {
      return {
        ok: false,
        error: {
          code: CCE_ERROR.DECRYPTION_FAILED,
          message: `Sensor ${sensor.name} failed`,
        },
        status: "ERROR",
      };
    }

    const normalized = normalizeSensorDecision(decision);
    if (!normalized.allow) {
      const code =
        normalized.reasons[0]?.split(":")[0] ?? CCE_ERROR.DECRYPTION_FAILED;
      return {
        ok: false,
        error: { code, message: normalized.reasons.join("; ") },
        status: "DENIED",
      };
    }
  }

  // Extract verified state
  const capsule = sensorInput.metadata?.cceCapsule as CceCapsuleClaims;
  const decryptedPayload = sensorInput.metadata
    ?.cceDecryptedPayload as Uint8Array;
  const clientKey = sensorInput.metadata?.cceClientKey as {
    publicKeyHex: string;
  };

  if (!capsule || !decryptedPayload || !clientKey) {
    return {
      ok: false,
      error: {
        code: CCE_ERROR.DECRYPTION_FAILED,
        message: "Sensor chain did not produce required outputs",
      },
      status: "ERROR",
    };
  }

  // Derive execution context
  const derivationInput: CceDerivationInput = {
    axisLocalSecret: config.axisLocalSecret,
    capsule,
    requestNonce: envelope.request_nonce,
  };
  const executionContext = buildExecutionContext(
    derivationInput,
    envelope.request_id,
  );

  // Route to handler
  const handler = config.handlers.get(capsule.intent);
  if (!handler) {
    return {
      ok: false,
      error: {
        code: CCE_ERROR.HANDLER_NOT_FOUND,
        message: `No handler for intent: ${capsule.intent}`,
      },
      status: "ERROR",
    };
  }

  // Execute handler
  const handlerContext: CceHandlerContext = {
    capsule,
    executionContext,
    envelope,
    clientPublicKeyHex: clientKey.publicKeyHex,
    intent: capsule.intent,
    sub: capsule.sub,
  };

  let result: CceHandlerResult;
  const handlerStart = Date.now();
  try {
    result = await handler(decryptedPayload, handlerContext);
  } catch (err) {
    const handlerDuration = Date.now() - handlerStart;

    // Record failure witness
    const verification = extractVerificationState(sensorInput.metadata ?? {});
    const witness = buildWitnessRecord(
      envelope,
      capsule,
      verification,
      { status: "FAILED", handlerDurationMs: handlerDuration },
      {
        axisLocalSecret: config.axisLocalSecret,
        requestPayload: decryptedPayload,
        responseEncrypted: false,
      },
    );
    await config.witnessStore.record(witness);

    return {
      ok: false,
      error: {
        code: CCE_ERROR.HANDLER_EXECUTION_FAILED,
        message: "Handler execution failed",
      },
      status: "FAILED",
    };
  }
  const handlerDuration = Date.now() - handlerStart;

  // Encrypt response
  let responseEnvelope: CceResponseEnvelope;
  let responsePayloadHash: string;

  try {
    const responseResult = await buildCceResponse(
      {
        request: envelope,
        capsule,
        status: result.status,
        body: result.body,
        clientPublicKeyHex: clientKey.publicKeyHex,
      },
      config.clientKeyEncryptor,
      config.axisSigner,
    );
    responseEnvelope = responseResult.envelope;
    responsePayloadHash = responseResult.responsePayloadHash;
  } catch (err) {
    return {
      ok: false,
      error: {
        code: CCE_ERROR.RESPONSE_ENCRYPTION_FAILED,
        message: "Response encryption failed",
      },
      status: "ERROR",
    };
  }

  // Record witness
  const verification = extractVerificationState(sensorInput.metadata ?? {});
  const witness = buildWitnessRecord(
    envelope,
    capsule,
    verification,
    {
      status: result.status,
      handlerDurationMs: handlerDuration,
      effect: result.effect,
    },
    {
      axisLocalSecret: config.axisLocalSecret,
      requestPayload: decryptedPayload,
      responsePayload: result.body,
      responseEncrypted: true,
    },
  );
  await config.witnessStore.record(witness);

  return {
    ok: true,
    response: responseEnvelope,
    witnessId: witness.witness_id,
  };
}
