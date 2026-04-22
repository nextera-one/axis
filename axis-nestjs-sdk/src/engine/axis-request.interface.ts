import type { AxisObservation } from "@nextera.one/axis-server-sdk";

/**
 * Result of the engine's decode+validate phase.
 * Kept loose here so the SDK interface doesn't pin consumers to a
 * specific frame/packet shape.
 */
export interface AxisDecodedResult {
  observation: AxisObservation;
  correlationIdHex: string;
  /** True when decode/validate failed and `body`/`statusCode` carry the error. */
  // Engines return ChainResult-shaped objects on failure and AxisDecoded on success.
  // We deliberately keep this loose.
  [key: string]: any;
}

export interface AxisEngineResult {
  statusCode: number;
  body?: any;
  headers?: Map<number, Uint8Array | Buffer>;
  allowed?: boolean;
}

export interface AxisProcessExtra {
  ip?: string;
  demoPubkeyHex?: string;
  observation?: AxisObservation;
}

/**
 * Minimal interface implemented by the concrete AXIS request engine.
 *
 * Nest glue provided by this SDK (`AxisDecodeInterceptor`,
 * `AxisIngressMiddleware`) only depend on this shape, so backends can
 * bring their own engine implementation.
 */
export interface IAxisRequestEngine {
  /** All-in-one: decode → sensors → route → finalize. */
  process(
    frameBytes: Buffer,
    extra: AxisProcessExtra,
  ): Promise<AxisEngineResult>;

  /** Decode + pre-execution sensors only. Returns AxisDecoded on success or engine-result on failure. */
  decode(
    frameBytes: Buffer,
    extra: AxisProcessExtra,
  ): Promise<AxisDecodedResult | AxisEngineResult>;

  /** Execute a previously decoded frame. */
  execute(decoded: AxisDecodedResult): Promise<AxisEngineResult>;
}

/**
 * Injection token for the concrete engine. Provide your implementation
 * with `{ provide: AXIS_REQUEST_ENGINE, useClass: YourEngine }` or
 * `{ provide: AXIS_REQUEST_ENGINE, useExisting: YourEngine }`.
 */
export const AXIS_REQUEST_ENGINE = Symbol("AXIS_REQUEST_ENGINE");
