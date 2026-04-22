/**
 * AxisTlvDto — lightweight base class for TLV-decorated DTOs.
 *
 * This stays local to the NestJS adapter package so DTO helpers do not need to
 * import the server SDK barrel and trigger a circular dependency.
 */
export abstract class AxisTlvDto {
  static afterDecode(_dto: Record<string, any>): void {
    // Default no-op hook for subclasses.
  }
}
