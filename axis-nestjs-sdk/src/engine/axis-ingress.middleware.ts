import { Inject, Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { PriorityOrder } from "../decorators/priority-order.decorator";

import { AxisMediaTypes } from "../http/media-types";
import { wasResponseClosedEarly } from "../http/request-lifecycle";
import {
  AXIS_REQUEST_ENGINE,
  IAxisRequestEngine,
} from "./axis-request.interface";

/**
 * AxisIngressMiddleware — HTTP ingress for binary AXIS frames.
 *
 * Accepts a raw `Buffer` body, hands it to `engine.process()`, and
 * writes the engine's result back as the HTTP response.
 *
 * Mount it for `POST /axis` (or your configured path) with a raw body
 * parser in front. Runs in demo mode when `NODE_ENV === 'development'`
 * to allow the `x-demo-pubkey` header.
 */
@PriorityOrder("HIGH", 20)
@Injectable()
export class AxisIngressMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AxisIngressMiddleware.name);
  private readonly demoMode: boolean;

  constructor(
    @Inject(AXIS_REQUEST_ENGINE) private readonly engine: IAxisRequestEngine,
  ) {
    this.demoMode = process.env.NODE_ENV === "development";
    if (this.demoMode) {
      this.logger.warn(
        "⚠️  DEMO MODE ACTIVE — x-demo-pubkey header bypass is enabled",
      );
    }
  }

  async use(req: Request, res: Response, _next: NextFunction) {
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) {
      res.status(400).type(AxisMediaTypes.TEXT).send("ERROR:EMPTY_BODY");
      return;
    }

    const observed = (req as any).axisObserved;
    const ip =
      observed?.ip ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      undefined;

    const demoPubkeyHex = this.demoMode
      ? (req.headers["x-demo-pubkey"] as string | undefined)
      : undefined;

    const startedAt = Date.now();
    let clientGone = false;

    req.once("aborted", () => {
      clientGone = true;
      this.logger.warn(`AXIS request aborted by client [${ip}]`);
    });

    res.once("close", () => {
      if (wasResponseClosedEarly(res)) {
        clientGone = true;
        this.logger.warn(`AXIS response stream closed early [${ip}]`);
      }
    });

    try {
      const out = await this.engine.process(raw, { ip, demoPubkeyHex });
      const duration = Date.now() - startedAt;

      if (clientGone || res.writableEnded) {
        this.logger.warn(
          `AXIS response dropped after disconnect [${ip}] ${duration}ms`,
        );
        return;
      }

      if (out.statusCode >= 400) {
        this.logger.warn(
          `AXIS request failed: ${out.body} [${ip}] ${duration}ms`,
        );
      } else {
        this.logger.debug(`AXIS request: ${out.body} [${ip}] ${duration}ms`);
      }

      if (out.headers) {
        out.headers.forEach((value, key) => {
          res.setHeader(
            `X-AXIS-TLV-${key}`,
            Buffer.from(value).toString("base64"),
          );
        });
      }

      const responseBody =
        out.body instanceof Uint8Array && !Buffer.isBuffer(out.body)
          ? Buffer.from(out.body)
          : out.body;

      // Never forward raw engine body on server errors — may contain internals
      if (out.statusCode >= 500) {
        res
          .status(out.statusCode)
          .type(AxisMediaTypes.TEXT)
          .send("ERROR:INTERNAL_FAILURE");
        return;
      }

      const contentType = AxisMediaTypes.responseTypeFor(responseBody);

      res.status(out.statusCode).type(contentType).send(responseBody);
    } catch (error: any) {
      const duration = Date.now() - startedAt;
      this.logger.error(
        `AXIS ingress failure: ${error.message} ${duration}ms`,
        error.stack,
      );

      if (clientGone || res.writableEnded) {
        return;
      }

      res.status(500).type(AxisMediaTypes.TEXT).send("ERROR:INTERNAL_FAILURE");
    }
  }
}
