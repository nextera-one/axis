import type { AxisEffect } from "./intent.router";

/**
 * Built-in AXIS intents handled by the SDK router without app registration.
 *
 * Keep this list small: these are protocol/control-plane intents, not business
 * handlers. CHAIN.EXEC and INTENT.EXEC are listed here so lookup APIs treat
 * them as known intents, but their execution is delegated back to IntentRouter.
 */
export const BUILTIN_INTENTS = new Set([
  "system.ping",
  "public.ping",
  "system.time",
  "system.echo",
  "CHAIN.EXEC",
  "axis.chain.exec",
  "INTENT.EXEC",
  "axis.intent.exec",
]);

export function isBuiltinIntent(intent: string): boolean {
  return BUILTIN_INTENTS.has(intent);
}

/** True for chain meta-intents that execute a multi-step AXIS chain envelope. */
export function isChainExecIntent(intent: string): boolean {
  return intent === "CHAIN.EXEC" || intent === "axis.chain.exec";
}

/** True for meta-intents that unwrap and execute one inner AXIS intent. */
export function isIntentExecIntent(intent: string): boolean {
  return intent === "INTENT.EXEC" || intent === "axis.intent.exec";
}

/**
 * Executes simple system built-ins that do not need app handlers.
 * Returns undefined for meta built-ins handled by the router itself.
 */
export function routeSystemBuiltinIntent(
  intent: string,
  body: Uint8Array,
  encoder: TextEncoder,
): AxisEffect | undefined {
  if (intent === "system.ping" || intent === "public.ping") {
    return {
      ok: true,
      effect: "pong",
      headers: new Map([[100, encoder.encode("AXIS_BACKEND_V1")]]),
      body: encoder.encode(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        }),
      ),
    };
  }

  if (intent === "system.time") {
    const ts = Date.now().toString();
    return {
      ok: true,
      effect: "time",
      body: encoder.encode(
        JSON.stringify({
          ts,
          iso: new Date().toISOString(),
        }),
      ),
    };
  }

  if (intent === "system.echo") {
    return {
      ok: true,
      effect: "echo",
      body,
    };
  }

  return undefined;
}
