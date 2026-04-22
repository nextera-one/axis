import { createHash } from "crypto";

import type { AxisFrame } from "../core/axis-bin";
import { FLAG_CHAIN_REQ, TLV_ACTOR_ID, TLV_CAPSULE, TLV_INTENT, TLV_TRACE_ID } from "../core/constants";
import type { AxisObserverBinding } from "../decorators/observer.decorator";
import type {
  AxisChainEnvelope,
  AxisChainResult,
  AxisChainStatus,
  AxisChainStep,
  AxisChainStepResult,
  AxisChainStepStatus,
  AxisExecutionMode,
} from "./axis-chain.types";
import {
  getAxisExecutionContext,
  mergeAxisExecutionContext,
  withAxisExecutionContext,
} from "./axis-execution-context";
import { ObserverDispatcherService } from "./observer-dispatcher.service";
import { AxisEffect, IntentRouter } from "./intent.router";
import { createAxisLogger } from "../utils/axis-logger";

export interface AxisChainExecutionOptions {
  actorId?: string;
  baseFrame?: Partial<AxisFrame>;
}

export class AxisChainExecutor {
  private readonly logger = createAxisLogger(AxisChainExecutor.name);
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  constructor(
    private readonly router: IntentRouter,
    private readonly observerDispatcher?: ObserverDispatcherService,
  ) {}

  async execute(
    envelope: AxisChainEnvelope,
    options: AxisChainExecutionOptions = {},
  ): Promise<AxisChainResult> {
    this.validateEnvelope(envelope);

    const startedAt = Date.now();
    const results = new Map<string, AxisChainStepResult>();
    const bindings = this.collectChainBindings(envelope);

    await this.dispatch(bindings, {
      event: "chain.received",
      timestamp: startedAt,
      chainId: envelope.chainId,
      envelope,
      observerTags: envelope.observerTags,
      capsule: envelope.capsule,
      keyExchange: envelope.keyExchange,
    });

    await this.dispatch(bindings, {
      event: "chain.admitted",
      timestamp: Date.now(),
      chainId: envelope.chainId,
      envelope,
      observerTags: envelope.observerTags,
      capsule: envelope.capsule,
      keyExchange: envelope.keyExchange,
    });

    const stepsById = new Map(envelope.steps.map((step) => [step.stepId, step]));
    const pending = new Set(stepsById.keys());

    while (pending.size > 0) {
      const ready = Array.from(pending)
        .map((stepId) => stepsById.get(stepId)!)
        .filter((step) => this.canRun(step, results));

      if (ready.length === 0) {
        this.markUnresolvedSteps(
          pending,
          stepsById,
          results,
          "BLOCKED",
          "UNRESOLVED_DEPENDENCIES",
        );
        break;
      }

      if (envelope.mode === "parallel") {
        const waveResults = await Promise.all(
          ready.map((step) => this.executeStep(step, envelope, results, options)),
        );
        for (const result of waveResults) {
          results.set(result.stepId, result);
          pending.delete(result.stepId);
        }
      } else {
        for (const step of ready) {
          const result = await this.executeStep(step, envelope, results, options);
          results.set(result.stepId, result);
          pending.delete(result.stepId);

          if (
            result.status === "FAILED" &&
            (envelope.mode === "strict" || envelope.mode === "atomic")
          ) {
            this.markUnresolvedSteps(
              pending,
              stepsById,
              results,
              "SKIPPED",
              "CHAIN_HALTED",
            );
            pending.clear();
            break;
          }
        }
      }

      this.blockStepsWithFailedDependencies(pending, stepsById, results);
    }

    const finishedAt = Date.now();
    const orderedResults = envelope.steps.map((step) => results.get(step.stepId)!);
    const summary = this.buildSummary(envelope.mode, orderedResults, startedAt, finishedAt, envelope.chainId);

    await this.dispatch(bindings, {
      event:
        summary.status === "SUCCEEDED"
          ? "chain.completed"
          : summary.status === "PARTIAL"
            ? "chain.partial"
            : "chain.failed",
      timestamp: finishedAt,
      chainId: envelope.chainId,
      envelope,
      result: summary,
      observerTags: envelope.observerTags,
      capsule: envelope.capsule,
      keyExchange: envelope.keyExchange,
    });

    return summary;
  }

  private async executeStep(
    step: AxisChainStep,
    envelope: AxisChainEnvelope,
    results: Map<string, AxisChainStepResult>,
    options: AxisChainExecutionOptions,
  ): Promise<AxisChainStepResult> {
    const stepBindings = this.router.getObservers(step.intent);
    const startedAt = Date.now();
    const input = this.resolveStepInput(step.input, results);

    await this.dispatch(stepBindings, {
      event: "step.started",
      timestamp: startedAt,
      chainId: envelope.chainId,
      stepId: step.stepId,
      intent: step.intent,
      envelope,
      step,
      observerTags: [...(envelope.observerTags || []), ...(step.observerTags || [])],
      capsule: step.capsuleScope
        ? {
            ...envelope.capsule,
            scope: step.capsuleScope,
          }
        : envelope.capsule,
      keyExchange: step.keyExchange || envelope.keyExchange,
    });

    try {
      const frame = this.buildFrame(step, envelope, input, options);
      const effect = await this.router.route(frame);
      const finishedAt = Date.now();
      const output = this.decodeOutput(effect.body);
      const proofHash = this.computeProofHash(envelope.chainId, step.stepId, effect, output);

      const result: AxisChainStepResult = {
        stepId: step.stepId,
        intent: step.intent,
        status: "SUCCEEDED",
        effect: effect.effect,
        output,
        dependsOn: step.dependsOn,
        startedAt,
        finishedAt,
        proofHash,
        observerTags: [...(envelope.observerTags || []), ...(step.observerTags || [])],
        metadata: effect.metadata,
      };

      await this.dispatch(stepBindings, {
        event: "handler.completed",
        timestamp: finishedAt,
        chainId: envelope.chainId,
        stepId: step.stepId,
        intent: step.intent,
        effect,
        envelope,
        step,
        result,
        observerTags: result.observerTags,
        capsule: envelope.capsule,
        keyExchange: step.keyExchange || envelope.keyExchange,
      });

      await this.dispatch(stepBindings, {
        event: "proof.recorded",
        timestamp: finishedAt,
        chainId: envelope.chainId,
        stepId: step.stepId,
        intent: step.intent,
        envelope,
        step,
        result,
        observerTags: result.observerTags,
        capsule: envelope.capsule,
        keyExchange: step.keyExchange || envelope.keyExchange,
        metadata: { proofHash },
      });

      await this.dispatch(stepBindings, {
        event: "step.completed",
        timestamp: finishedAt,
        chainId: envelope.chainId,
        stepId: step.stepId,
        intent: step.intent,
        effect,
        envelope,
        step,
        result,
        observerTags: result.observerTags,
        capsule: envelope.capsule,
        keyExchange: step.keyExchange || envelope.keyExchange,
      });

      return result;
    } catch (error: any) {
      const finishedAt = Date.now();
      const result: AxisChainStepResult = {
        stepId: step.stepId,
        intent: step.intent,
        status: "FAILED",
        error: error.message,
        dependsOn: step.dependsOn,
        startedAt,
        finishedAt,
        observerTags: [...(envelope.observerTags || []), ...(step.observerTags || [])],
      };

      this.logger.warn(
        `Chain ${envelope.chainId} step ${step.stepId} failed: ${error.message}`,
      );

      await this.dispatch(stepBindings, {
        event: "step.failed",
        timestamp: finishedAt,
        chainId: envelope.chainId,
        stepId: step.stepId,
        intent: step.intent,
        error: error.message,
        envelope,
        step,
        result,
        observerTags: result.observerTags,
        capsule: envelope.capsule,
        keyExchange: step.keyExchange || envelope.keyExchange,
      });

      return result;
    }
  }

  private buildFrame(
    step: AxisChainStep,
    envelope: AxisChainEnvelope,
    input: unknown,
    options: AxisChainExecutionOptions,
  ): AxisFrame {
    const baseContext = getAxisExecutionContext(options.baseFrame);
    const baseHeaders = new Map(options.baseFrame?.headers || []);
    baseHeaders.set(TLV_INTENT, this.encoder.encode(step.intent));
    baseHeaders.set(TLV_TRACE_ID, this.encoder.encode(envelope.chainId));

    const capsuleId = envelope.capsule?.capsuleId;
    if (capsuleId) {
      baseHeaders.set(TLV_CAPSULE, this.encoder.encode(capsuleId));
    }

    if (options.actorId) {
      baseHeaders.set(TLV_ACTOR_ID, this.encoder.encode(options.actorId));
    }

    return withAxisExecutionContext(
      {
      flags: (options.baseFrame?.flags || 0) | FLAG_CHAIN_REQ,
      headers: baseHeaders,
      body: this.serializeInput(input),
      sig: options.baseFrame?.sig || new Uint8Array(0),
      },
      mergeAxisExecutionContext(baseContext, {
        metaIntent: "CHAIN.EXEC",
        actorId: options.actorId || baseContext?.actorId,
        capsuleRef: step.capsuleScope
          ? {
              ...(envelope.capsule || {}),
              scope: step.capsuleScope,
            }
          : envelope.capsule,
        chainEnvelope: envelope,
        chainStep: step,
      }) || {},
    );
  }

  private validateEnvelope(envelope: AxisChainEnvelope): void {
    if (!envelope.chainId) {
      throw new Error("CHAIN_ID_REQUIRED");
    }

    if (!envelope.steps || envelope.steps.length === 0) {
      throw new Error("CHAIN_STEPS_REQUIRED");
    }

    const seen = new Set<string>();
    for (const step of envelope.steps) {
      if (!step.stepId) {
        throw new Error("CHAIN_STEP_ID_REQUIRED");
      }

      if (!step.intent) {
        throw new Error(`CHAIN_STEP_INTENT_REQUIRED:${step.stepId}`);
      }

      if (seen.has(step.stepId)) {
        throw new Error(`CHAIN_STEP_DUPLICATE:${step.stepId}`);
      }
      seen.add(step.stepId);
    }

    for (const step of envelope.steps) {
      for (const dependency of step.dependsOn || []) {
        if (!seen.has(dependency)) {
          throw new Error(
            `CHAIN_STEP_DEPENDENCY_UNKNOWN:${step.stepId}:${dependency}`,
          );
        }
      }
    }
  }

  private canRun(
    step: AxisChainStep,
    results: Map<string, AxisChainStepResult>,
  ): boolean {
    return (step.dependsOn || []).every((dependency) => results.has(dependency));
  }

  private blockStepsWithFailedDependencies(
    pending: Set<string>,
    stepsById: Map<string, AxisChainStep>,
    results: Map<string, AxisChainStepResult>,
  ): void {
    for (const stepId of Array.from(pending)) {
      const step = stepsById.get(stepId);
      if (!step || !step.dependsOn || step.dependsOn.length === 0) continue;

      const dependencyResults = step.dependsOn
        .map((dependency) => results.get(dependency))
        .filter(Boolean) as AxisChainStepResult[];

      if (dependencyResults.length !== step.dependsOn.length) continue;

      const hasFailure = dependencyResults.some(
        (dependency) => dependency.status !== "SUCCEEDED",
      );
      if (!hasFailure) continue;

      results.set(step.stepId, {
        stepId: step.stepId,
        intent: step.intent,
        status: "BLOCKED",
        error: "DEPENDENCY_FAILED",
        dependsOn: step.dependsOn,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        observerTags: step.observerTags,
      });
      pending.delete(step.stepId);
    }
  }

  private markUnresolvedSteps(
    pending: Set<string>,
    stepsById: Map<string, AxisChainStep>,
    results: Map<string, AxisChainStepResult>,
    status: AxisChainStepStatus,
    error: string,
  ): void {
    for (const stepId of pending) {
      const step = stepsById.get(stepId);
      if (!step) continue;
      results.set(stepId, {
        stepId,
        intent: step.intent,
        status,
        error,
        dependsOn: step.dependsOn,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        observerTags: step.observerTags,
      });
    }
  }

  private buildSummary(
    mode: AxisExecutionMode,
    results: AxisChainStepResult[],
    startedAt: number,
    finishedAt: number,
    chainId: string,
  ): AxisChainResult {
    const completedSteps = results.filter((result) => result.status === "SUCCEEDED").length;
    const failedSteps = results.filter((result) => result.status === "FAILED").length;
    const blockedSteps = results.filter((result) => result.status === "BLOCKED").length;
    const skippedSteps = results.filter((result) => result.status === "SKIPPED").length;

    let status: AxisChainStatus = "SUCCEEDED";
    if (failedSteps > 0 || blockedSteps > 0 || skippedSteps > 0) {
      status =
        mode === "best_effort" || mode === "parallel"
          ? completedSteps > 0
            ? "PARTIAL"
            : "FAILED"
          : "FAILED";
    }

    return {
      chainId,
      mode,
      status,
      completedSteps,
      failedSteps,
      blockedSteps,
      skippedSteps,
      startedAt,
      finishedAt,
      results,
      rollback:
        mode === "atomic"
          ? {
              supported: false,
              attempted: false,
              reason: "AXIS handlers do not expose rollback semantics yet",
            }
          : undefined,
    };
  }

  private resolveStepInput(
    value: unknown,
    results: Map<string, AxisChainStepResult>,
  ): unknown {
    if (typeof value === "string") {
      if (!value.startsWith("$")) return value;
      return this.lookupReference(value.slice(1), results);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.resolveStepInput(entry, results));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          this.resolveStepInput(entry, results),
        ]),
      );
    }

    return value;
  }

  private lookupReference(
    path: string,
    results: Map<string, AxisChainStepResult>,
  ): unknown {
    const [stepId, ...segments] = path.split(".");
    const result = results.get(stepId);
    if (!result) return undefined;

    let current: unknown = result;
    for (const segment of segments) {
      if (current === undefined || current === null) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  private serializeInput(input: unknown): Uint8Array {
    if (input instanceof Uint8Array) return input;
    if (typeof input === "string") return this.encoder.encode(input);
    if (input === undefined) return new Uint8Array(0);
    return this.encoder.encode(JSON.stringify(input));
  }

  private decodeOutput(body?: Uint8Array): unknown {
    if (!body || body.length === 0) return undefined;

    try {
      const text = this.decoder.decode(body);
      try {
        return JSON.parse(text);
      } catch {
        return /^[\x20-\x7E\s]+$/.test(text) ? text : body;
      }
    } catch {
      return body;
    }
  }

  private computeProofHash(
    chainId: string,
    stepId: string,
    effect: AxisEffect,
    output: unknown,
  ): string {
    const hash = createHash("sha256");
    hash.update(chainId);
    hash.update(":");
    hash.update(stepId);
    hash.update(":");
    hash.update(effect.effect);
    hash.update(":");
    hash.update(JSON.stringify(output ?? null));
    return hash.digest("hex");
  }

  private collectChainBindings(
    envelope: AxisChainEnvelope,
  ): AxisObserverBinding[] {
    const uniqueBindings = new Map<string, AxisObserverBinding>();

    for (const step of envelope.steps) {
      for (const binding of this.router.getObservers(step.intent)) {
        const key = binding.refs.map((ref) => String(ref)).sort().join("|");
        if (!uniqueBindings.has(key)) {
          uniqueBindings.set(key, binding);
        }
      }
    }

    return Array.from(uniqueBindings.values());
  }

  private async dispatch(
    bindings: AxisObserverBinding[],
    context: Parameters<ObserverDispatcherService["dispatch"]>[1],
  ): Promise<void> {
    if (!this.observerDispatcher) return;
    await this.observerDispatcher.dispatch(bindings, context);
  }
}
