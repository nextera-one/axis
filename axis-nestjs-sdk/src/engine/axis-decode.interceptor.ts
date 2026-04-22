import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";

import {
  AXIS_REQUEST_ENGINE,
  AxisDecodedResult,
  AxisEngineResult,
  IAxisRequestEngine,
} from "./axis-request.interface";

/**
 * AxisDecodeInterceptor
 *
 * Runs `engine.decode()` before the controller method executes,
 * attaching the decoded + validated result to `req.axisDecoded`.
 *
 * If decode fails (sensor deny, bad frame, etc.) the interceptor throws
 * an HttpException immediately — the controller method is never reached.
 *
 * Usage:
 * ```typescript
 * @UseInterceptors(AxisDecodeInterceptor)
 * @Intent('engine.decode', { absolute: true, kind: 'action' })
 * async handle(@AxisFrame() decoded: AxisDecodedResult) {
 *   return this.engine.execute(decoded);
 * }
 * ```
 */
@Injectable()
export class AxisDecodeInterceptor implements NestInterceptor {
  constructor(
    @Inject(AXIS_REQUEST_ENGINE) private readonly engine: IAxisRequestEngine,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.body as Buffer;

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      undefined;

    const demoPubkeyHex =
      process.env.NODE_ENV === "development"
        ? (req.headers["x-demo-pubkey"] as string | undefined)
        : undefined;

    const result = await this.engine.decode(raw, { ip, demoPubkeyHex });

    // If decode returned an engine-result (has statusCode), it's an error
    if (
      "statusCode" in result &&
      typeof (result as any).observation === "undefined"
    ) {
      const chainResult = result as AxisEngineResult;
      throw new HttpException(
        chainResult.body ?? "DECODE_FAILED",
        chainResult.statusCode,
      );
    }

    (req as any).axisDecoded = result as AxisDecodedResult;
    return next.handle();
  }
}
