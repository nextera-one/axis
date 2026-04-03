import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { AxisDecoded } from '../engine/axis-decoded';

/**
 * Shape of the AXIS-specific data attached to the request by AxisSensorsMiddleware.
 */
export interface AxisRequestData {
  /** Raw binary frame body (full buffer after streaming) */
  raw: Buffer;
  /** Resolved client IP address */
  ip: string | undefined;
  /** Pre-decode sensor context (risk score, metadata) */
  preDecodeInput: any;
  /** Total frame bytes received */
  frameBytesCount: number;
}

/**
 * Resolves the client IP from request headers, respecting common proxy headers.
 */
function resolveIp(req: Request): string | undefined {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    undefined
  );
}

/**
 * @AxisRaw() — Extracts the raw binary Buffer from an AXIS request.
 *
 * Equivalent to NestJS `@Body()` but for the AXIS binary protocol.
 * The buffer has already passed streaming validation (magic bytes, size limits)
 * via AxisSensorsMiddleware before reaching the controller.
 *
 * @example
 * ```typescript
 * @Post()
 * async handle(@AxisRaw() raw: Buffer) {
 *   return this.axis.process(raw, { ... });
 * }
 * ```
 */
export const AxisRaw = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Buffer => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.body as Buffer;
  },
);

/**
 * @AxisIp() — Extracts the resolved client IP address.
 *
 * Checks `x-forwarded-for`, `x-real-ip`, and `socket.remoteAddress` in order.
 *
 * @example
 * ```typescript
 * @Post()
 * async handle(@AxisIp() ip: string | undefined) { ... }
 * ```
 */
export const AxisIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return resolveIp(req);
  },
);

/**
 * @AxisContext() — Extracts the full AXIS request context.
 *
 * Returns the pre-decode sensor input and frame metadata attached by
 * AxisSensorsMiddleware. Useful when a controller needs risk scores or
 * other pre-decode metadata.
 *
 * @example
 * ```typescript
 * @Post()
 * async handle(@AxisContext() ctx: AxisRequestData) {
 *   console.log(ctx.frameBytesCount, ctx.preDecodeInput.metadata.riskScore);
 * }
 * ```
 */
export const AxisContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AxisRequestData => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const axisData = (req as any).axis || {};
    return {
      raw: req.body as Buffer,
      ip: resolveIp(req),
      preDecodeInput: axisData.preDecodeInput,
      frameBytesCount: axisData.frameBytesCount || 0,
    };
  },
);

/**
 * @AxisDemoPubkey() — Extracts the demo public key header (development only).
 *
 * Returns `undefined` in non-development environments, blocking the header
 * at the decorator level.
 *
 * @example
 * ```typescript
 * @Post()
 * async handle(@AxisDemoPubkey() demoPubkeyHex: string | undefined) { ... }
 * ```
 */
export const AxisDemoPubkey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    if (process.env.NODE_ENV !== 'development') return undefined;
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.headers['x-demo-pubkey'] as string | undefined;
  },
);

/**
 * @AxisFrame() — Extracts the decoded + validated AXIS frame from the request.
 *
 * Requires `AxisDecodeInterceptor` to be applied to the route/controller.
 * The interceptor calls `AxisService.decode()` and attaches the result to `req.axisDecoded`.
 *
 * Returns the full `AxisDecoded` object containing the decoded frame, packet,
 * AxisContext, sensor input, and correlation IDs.
 *
 * @example
 * ```typescript
 * @Post('v1/decoded')
 * @UseInterceptors(AxisDecodeInterceptor)
 * async handle(@AxisFrame() decoded: AxisDecoded) {
 *   return this.axis.execute(decoded);
 * }
 * ```
 */
export const AxisFrame = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AxisDecoded => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const decoded = (req as any).axisDecoded as AxisDecoded | undefined;
    if (!decoded) {
      throw new Error(
        '@AxisFrame() requires AxisDecodeInterceptor on the route. ' +
          'Add @UseInterceptors(AxisDecodeInterceptor) to use this decorator.',
      );
    }
    return decoded;
  },
);
