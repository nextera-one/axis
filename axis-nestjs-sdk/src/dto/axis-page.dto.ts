import { AxisTlvDto, TlvField } from "@nextera.one/axis-server-sdk";

/**
 * AxisPageDto — reusable paged-read DTO.
 *
 * Fields:
 *  - `id`, `created_at`, `created_by`, `updated_at`, `updated_by` — audit fields
 *  - `params` — opaque JSON blob typically carrying `{ filter, sort, pagination }`
 *
 * The static `afterDecode` hook is picked up automatically by
 * `buildDtoDecoder()` so handlers never need to null-guard `params`.
 *
 * Domain fields (`log`, `partner`, etc.) should live on a subclass in
 * the consuming project — keep this DTO protocol-generic.
 */
export class AxisPageDto extends AxisTlvDto {
  @TlvField(100, { kind: "utf8" })
  id?: string;

  @TlvField(101, { kind: "utf8" })
  created_at?: Date;

  @TlvField(102, { kind: "utf8" })
  created_by?: string;

  @TlvField(103, { kind: "utf8" })
  updated_at?: Date;

  @TlvField(104, { kind: "utf8" })
  updated_by?: string;

  @TlvField(99, { kind: "obj" })
  params?: Record<string, any>;

  /**
   * Ensures `params/filter/sort/pagination` are always present as objects
   * even if the client omitted TLV tag 99.
   */
  static afterDecode(dto: Record<string, any>): void {
    if (
      !dto.params ||
      typeof dto.params !== "object" ||
      Array.isArray(dto.params)
    ) {
      dto.params = {};
    }
    if (!dto.params.filter) dto.params.filter = {};
    if (!dto.params.sort) dto.params.sort = {};
    if (!dto.params.pagination) dto.params.pagination = {};
  }
}
