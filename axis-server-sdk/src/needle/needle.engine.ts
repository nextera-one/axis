/**
 * Needle Engine — The unified execution pipeline
 *
 * Runs the full formula:
 *   Intent → Needle enters (AXIS) → Action happens →
 *   Observer verifies → Stitch is formed → Thread grows
 *
 * Each phase maps to a concrete operation:
 *   created    → assembleNeedle()
 *   validated  → executeLoomPipeline() gates
 *   executing  → handler runs
 *   observed   → verifyObservation()
 *   stitched   → formStitch() + updateThreadState()
 */

import { createHash, randomBytes } from 'crypto';
import {
  createObservation,
  startStage,
  endStage,
  finalizeObservation,
  recordSensor,
} from '../engine/axis-observation';
import type { AxisObservation, ObservationStage } from '../engine/axis-observation';
import { scoreTruth } from '../engine/observation/truth-scoring';
import type { ExpectedOutcome, TruthVerdict } from '../engine/observation/truth-scoring';
import {
  validateWrit,
  createReceipt,
  updateThreadState,
} from '../loom/loom.engine';
import type { LoomReceipt, ThreadState } from '../loom/loom.types';
import type { CompiledIntent } from '../idel/idel.types';
import type {
  Needle,
  NeedleError,
  NeedleHandler,
  NeedleHandlerContext,
  NeedleHandlerResult,
  NeedlePipelineConfig,
  NeedlePipelineResult,
  Stitch,
  StitchKind,
  NeedlePhase,
} from './needle.types';
import type { Grant, PresenceReceipt, Writ } from '../loom/loom.types';
import type { AxisSensor, SensorInput } from '../sensor/axis-sensor';
import { normalizeSensorDecision } from '../sensor/axis-sensor';

// ────────────────────────────────────────────────────────────────────────────
// Needle Assembly
// ────────────────────────────────────────────────────────────────────────────

/**
 * Assemble a Needle — the execution carrier.
 * This combines intent + presence + writ + grants into a single context.
 */
export function assembleNeedle(params: {
  intent: CompiledIntent;
  presence: PresenceReceipt;
  writ: Writ;
  grants: Grant[];
  tps_coordinate?: string;
}): Needle {
  return {
    needle_id: randomBytes(16).toString('hex'),
    phase: 'created',
    tps_coordinate: params.tps_coordinate,
    intent: params.intent,
    presence: params.presence,
    writ: params.writ,
    grants: params.grants,
    created_at: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Stitch Formation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Determine stitch kind from observation and verdict.
 */
function classifyStitch(
  observation: AxisObservation,
  verdict: TruthVerdict,
): StitchKind {
  // Failed or disputed → torn
  if (verdict.status === 'failed' || verdict.status === 'disputed') {
    return 'torn';
  }

  // DENY or no visible effect → silent stitch
  if (observation.decision === 'DENY') {
    return 'silent';
  }

  // Confirmed or partial deed → deed
  if (verdict.isDeed) {
    return 'deed';
  }

  // Uncertain but not failed → silent
  return 'silent';
}

/**
 * Form a Stitch from a completed Needle.
 * A Stitch = Needle (execution) + Observer (verification)
 */
export function formStitch(
  needle: Needle,
  observation: AxisObservation,
  verdict: TruthVerdict,
  receipt: LoomReceipt,
): Stitch {
  return {
    stitch_id: needle.needle_id,
    kind: classifyStitch(observation, verdict),
    intent: needle.intent.intent,
    actor_id: needle.intent.actor_id,
    tps_coordinate: needle.tps_coordinate,
    observation,
    verdict,
    receipt,
    thread_id: receipt.thread_id,
    sequence: receipt.sequence,
    stitched_at: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Needle Pipeline
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run the full Needle pipeline:
 *
 *   1. Validate (Loom gates: temporal, causal, legal, authentic)
 *   2. Execute (handler runs the action)
 *   3. Observe (create observation + score truth)
 *   4. Stitch (form stitch, create receipt, grow thread)
 */
export async function runNeedlePipeline(
  needle: Needle,
  config: NeedlePipelineConfig,
  threadState: ThreadState | null,
  prevReceipt: LoomReceipt | null,
  expectedOutcome?: ExpectedOutcome,
): Promise<NeedlePipelineResult> {
  const obs = createObservation('http');
  obs.intent = needle.intent.intent;
  obs.actorId = needle.intent.actor_id;

  // ── Phase 1: Validate (Loom gates) ──
  needle.phase = 'validated';
  let stage: ObservationStage = startStage(obs, 'loom.validate');

  const validation = validateWrit(
    needle.writ,
    config.public_key,
    threadState,
    needle.grants,
  );

  if (!validation.valid) {
    endStage(stage, 'fail', validation.error);
    return failNeedle(needle, obs, 'validated', 'LOOM_VALIDATION_FAILED', validation.error ?? 'Writ validation failed');
  }

  endStage(stage, 'ok');

  // ── Phase 1.5: Sensors (reality gates) ──
  if (config.sensors && config.sensors.length > 0) {
    stage = startStage(obs, 'sensors.evaluate');

    const sensorInput: SensorInput = {
      intent: needle.intent.intent,
      actorId: needle.intent.actor_id,
      metadata: {
        observation: obs,
        needle_id: needle.needle_id,
        tps_coordinate: needle.tps_coordinate,
        writ: needle.writ,
        grants: needle.grants,
        params: needle.intent.params,
      },
    };

    for (const sensor of config.sensors) {
      if (sensor.supports && !sensor.supports(sensorInput)) continue;

      const t0 = Date.now();
      let decision;
      try {
        const rawDecision = await sensor.run(sensorInput);
        decision = normalizeSensorDecision(rawDecision);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        recordSensor(obs, sensor.name, false, 100, Date.now() - t0, [`sensor_error:${msg}`]);
        endStage(stage, 'fail', `Sensor ${sensor.name} threw: ${msg}`);
        return failNeedle(needle, obs, 'validated', 'SENSOR_ERROR', `Sensor ${sensor.name} failed: ${msg}`);
      }

      recordSensor(obs, sensor.name, decision.allow, decision.riskScore, Date.now() - t0, decision.reasons);

      if (!decision.allow) {
        endStage(stage, 'fail', `Sensor ${sensor.name} denied`);
        return failNeedle(needle, obs, 'validated', 'SENSOR_DENY', decision.reasons[0] ?? `Denied by ${sensor.name}`);
      }
    }

    endStage(stage, 'ok');
  }

  // ── Phase 2: Execute (handler) ──
  needle.phase = 'executing';
  stage = startStage(obs, 'handler.execute');

  const handler = config.handlers.get(needle.intent.intent);
  if (!handler) {
    endStage(stage, 'fail', `No handler for intent '${needle.intent.intent}'`);
    return failNeedle(needle, obs, 'executing', 'NO_HANDLER', `No handler registered for intent '${needle.intent.intent}'`);
  }

  const handlerCtx: NeedleHandlerContext = {
    needle_id: needle.needle_id,
    actor_id: needle.intent.actor_id,
    presence_id: needle.presence.presence_id,
    writ: needle.writ,
    grants: needle.grants,
    tps_coordinate: needle.tps_coordinate,
  };

  let handlerResult: NeedleHandlerResult;
  try {
    handlerResult = await handler(needle.intent, handlerCtx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    endStage(stage, 'fail', msg);
    return failNeedle(needle, obs, 'executing', 'HANDLER_ERROR', msg);
  }

  if (!handlerResult.ok) {
    endStage(stage, 'fail', handlerResult.effect);
    obs.decision = 'DENY';
    obs.resultCode = handlerResult.effect;
    obs.statusCode = handlerResult.status_code ?? 400;
  } else {
    endStage(stage, 'ok');
    obs.decision = 'ALLOW';
    obs.resultCode = handlerResult.effect;
    obs.statusCode = handlerResult.status_code ?? 200;
  }

  if (handlerResult.data) {
    obs.facts = { ...obs.facts, ...handlerResult.data };
  }

  // ── Phase 3: Observe ──
  needle.phase = 'observed';
  finalizeObservation(obs, obs.decision ?? 'DENY', obs.statusCode ?? 500, obs.resultCode);
  needle.observation = obs;

  const verdict = scoreTruth(obs, expectedOutcome);
  needle.verdict = verdict;

  // ── Phase 4: Stitch ──
  needle.phase = 'stitched';
  stage = startStage(obs, 'stitch.form');

  const receipt = createReceipt(
    needle.writ,
    obs.decision ?? 'DENY',
    prevReceipt,
  );
  needle.receipt = receipt;

  const newThreadState = updateThreadState(
    receipt,
    needle.intent.actor_id,
  );

  const stitch = formStitch(needle, obs, verdict, receipt);
  needle.completed_at = Date.now();

  endStage(stage, 'ok');

  return {
    ok: handlerResult.ok,
    needle,
    stitch,
    thread_state: newThreadState,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function failNeedle(
  needle: Needle,
  obs: AxisObservation,
  phase: NeedlePhase,
  code: string,
  message: string,
): NeedlePipelineResult {
  needle.phase = 'failed';
  needle.error = { phase, code, message };
  needle.completed_at = Date.now();

  obs.decision = obs.decision ?? 'DENY';
  obs.statusCode = obs.statusCode ?? 500;
  finalizeObservation(obs, obs.decision, obs.statusCode, obs.resultCode);
  needle.observation = obs;

  const verdict = scoreTruth(obs);
  needle.verdict = verdict;

  return {
    ok: false,
    needle,
  };
}
