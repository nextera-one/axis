/**
 * AXIS Receipt Hash Construction
 * Canonical receipt chain hash — protocol invariant.
 * Any compliant implementation must produce identical hashes.
 */
import { createHash } from 'crypto';

/** Canonical receipt effect types */
export type ReceiptEffect = 'ALLOW' | 'DENY' | 'ERROR';

/**
 * Builds the canonical SHA-256 hash for a receipt in the chain.
 *
 * Field order (protocol-defined):
 *   prevHash? | pid | actorId (utf8) | intent (utf8) | effect (utf8) | ts (utf8 string)
 *
 * @param prevHash  Previous receipt hash (null for first receipt)
 * @param pid       Process/packet ID (raw bytes)
 * @param actorId   Actor identifier (string)
 * @param intent    Intent name (string)
 * @param effect    Execution effect ('ALLOW' | 'DENY' | 'ERROR')
 * @param ts        Timestamp as bigint (milliseconds since epoch)
 * @returns 32-byte SHA-256 hash
 */
export function buildReceiptHash(
  prevHash: Buffer | null,
  pid: Buffer,
  actorId: string,
  intent: string,
  effect: ReceiptEffect,
  ts: bigint,
): Buffer {
  const h = createHash('sha256');
  if (prevHash) h.update(prevHash);
  h.update(pid);
  h.update(Buffer.from(actorId, 'utf8'));
  h.update(Buffer.from(intent, 'utf8'));
  h.update(Buffer.from(effect, 'utf8'));
  h.update(Buffer.from(ts.toString(), 'utf8'));
  return h.digest();
}
