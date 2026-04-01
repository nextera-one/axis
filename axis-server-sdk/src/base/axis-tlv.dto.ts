/**
 * AxisTlvDto — Base class for all TLV-decoded DTO classes.
 *
 * Any DTO decorated with @TlvField that is passed to @Intent({ dto })
 * should extend this class. This gives the CRUD handler interface
 * a type-safe union: `Uint8Array | AxisTlvDto`.
 *
 * The base is intentionally empty — it serves as a type marker.
 */
export abstract class AxisTlvDto {}
