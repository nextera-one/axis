import { AxisHandlerInit } from './axis-handler.interface';
import { AxisTlvDto } from '../base/axis-tlv.dto';

/**
 * Standard interface for Resource-based Intent Handlers (CRUD).
 *
 * Enforces strict 5-method contract:
 * - create (POST)
 * - findAll (GET collection)
 * - findOne (GET single)
 * - update (PATCH)
 * - remove (DELETE)
 *
 * Body parameter accepts raw bytes (Uint8Array) when no DTO is declared,
 * or a decoded DTO object when @Intent({ dto }) is used.
 */
export interface AxisCrudHandler extends AxisHandlerInit {
  create(
    body: Uint8Array | AxisTlvDto,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  findAll(
    body: Uint8Array | AxisTlvDto,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  findOne(
    body: Uint8Array | AxisTlvDto,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  update(
    body: Uint8Array | AxisTlvDto,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  remove(
    body: Uint8Array | AxisTlvDto,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;
}
