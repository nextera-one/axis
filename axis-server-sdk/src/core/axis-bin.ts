import * as z from 'zod';
import type { AxisFrame as ProtocolAxisFrame } from '@nextera.one/axis-protocol';

export {
  decodeFrame,
  encodeFrame,
  getSignTarget,
} from '@nextera.one/axis-protocol';
export type { AxisFrame, AxisBinaryFrame } from '@nextera.one/axis-protocol';

/**
 * AxisFrame Schema
 *
 * Defines the logical structure of an AXIS frame using Zod for runtime validation.
 * This is used for internal processing after the low-level binary parsing is complete.
 */
export const AxisFrameZ: z.ZodType<ProtocolAxisFrame> = z.object({
  /** Flag bits for protocol control (e.g., encryption, compression) */
  flags: z.number().int().nonnegative(),
  /** A map of TLV headers where key=Tag and value=BinaryData */
  headers: z.map(
    z.number(),
    z.custom<Uint8Array>((v) => v instanceof Uint8Array),
  ),
  /** The main payload of the frame */
  body: z.custom<Uint8Array>((v) => v instanceof Uint8Array),
  /** The cryptographic signature covering the frame (except the signature itself) */
  sig: z.custom<Uint8Array>((v) => v instanceof Uint8Array),
});
