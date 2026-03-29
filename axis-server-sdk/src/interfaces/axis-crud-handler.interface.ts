import { AxisHandlerInit } from './axis-handler.interface';

/**
 * Standard interface for Resource-based Intent Handlers (CRUD).
 *
 * Enforces strict 5-method contract:
 * - create (POST)
 * - findAll (GET collection)
 * - findOne (GET single)
 * - update (PATCH)
 * - remove (DELETE)
 */
export interface AxisCrudHandler extends AxisHandlerInit {
  create(
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  findAll(
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  findOne(
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  update(
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;

  remove(
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ): Promise<Uint8Array>;
}
