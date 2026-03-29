/**
 * Represents a structured AXIS frame as used for routing and handler invocations.
 *
 * The full binary parsing happens in the backend; this type is shared for
 * type-safe handler signatures across the SDK.
 */
export interface AxisFrame {
  /** Flag bits for protocol control (e.g., encryption, compression) */
  flags: number;
  /** A map of TLV headers where key=Tag and value=BinaryData */
  headers: Map<number, Uint8Array>;
  /** The main payload of the frame */
  body: Uint8Array;
  /** The cryptographic signature covering the frame */
  sig: Uint8Array;
  /** Optional per-frame metadata injected by the pipeline (e.g. IP address) */
  metadata?: Record<string, any>;
}
