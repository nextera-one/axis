/**
 * AxisTlvDto — Base class for all TLV-decoded DTO classes.
 *
 * Any DTO decorated with @TlvField that is passed to @Intent({ dto })
 * should extend this class. This gives the CRUD handler interface
 * a type-safe union: `Uint8Array | AxisTlvDto`.
 *
 * Subclasses may override `afterDecode()` to normalize decoded payloads
 * without needing a custom decoder for every intent.
 */
export abstract class AxisTlvDto {
  static afterDecode(_dto: Record<string, any>): void {
    // Default no-op hook for subclasses.
  }
}
