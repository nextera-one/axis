/**
 * AxisTlvDto — Base class for all TLV-decoded DTO classes.
 *
 * Any DTO decorated with @TlvField that is passed to @Intent({ dto })
 * should extend this class. This gives the CRUD handler interface
 * a type-safe union: `Uint8Array | AxisTlvDto`.
 *
 * Subclasses may define a static `afterDecode(dto: any): void` method.
 * `buildDtoDecoder` will call it after TLV decoding so that defaults
 * or normalisation can be applied without a separate @IntentBody decorator.
 */
export abstract class AxisTlvDto {
  /**
   * Optional post-decode hook.  Override in a subclass to normalise
   * the decoded plain object before it reaches the intent handler.
   *
   * Called by `buildDtoDecoder` with the mutable result object.
   * Return value is ignored — mutate `dto` in place.
   */
  static afterDecode?(dto: Record<string, any>): void;
}
