import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { IncomingMessage } from "http";
import { Server, WebSocket } from "ws";
import {
  AxisSensorChainService,
  decodeFrame,
  IntentRouter,
  normalizeSensorDecision,
  SensorInput,
} from "@nextera.one/axis-server-sdk";

/**
 * AxisWebSocketGatewayBase — reusable base class for AXIS WebSocket servers.
 *
 * Subclass and decorate with `@WebSocketGateway({ path: '/axis/gateway' })`
 * to expose a binary-frame endpoint backed by `IntentRouter` and the
 * `AxisSensorChainService`. Override protected hooks to customise
 * auth, per-connection state, etc.
 */
@WebSocketGateway({
  path: "/axis/gateway",
  adapter: "ws",
})
export class AxisWebSocketGatewayBase
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  protected server!: Server;

  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly sensors: AxisSensorChainService,
    protected readonly router: IntentRouter,
  ) {}

  async handleConnection(client: WebSocket, ..._args: any[]) {
    this.logger.log("AXIS WS client connected");
    const req = _args[0] as IncomingMessage | undefined;
    const ip =
      (req?.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req?.headers["x-real-ip"] as string) ||
      req?.socket?.remoteAddress ||
      (client as any)._socket?.remoteAddress ||
      undefined;
    (client as any).axisIp = ip;

    client.on("message", (data) => this.onMessage(client, data));
  }

  async handleDisconnect(_client: WebSocket) {
    this.logger.log("AXIS WS client disconnected");
  }

  /** Override to customise per-message handling. Default routes as AXIS frame. */
  protected async onMessage(client: WebSocket, data: any): Promise<void> {
    try {
      const buf: Buffer = Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);
      const frame = decodeFrame(buf);
      const ip: string | undefined = (client as any).axisIp;

      const sensorInput: SensorInput = {
        rawBytes: buf,
        context: { ip },
        headerTLVs: frame.headers,
        body: frame.body,
        intent: "",
        actorId: "",
        ip,
        path: "/axis/gateway",
        contentLength: frame.body.length,
        peek: frame.body.subarray(0, Math.min(64, frame.body.length)),
        metadata: { phase: "post-decode" },
      } as SensorInput;

      const decision = normalizeSensorDecision(
        await this.sensors.evaluatePost({
          actorId: "",
          opcode: "",
          observed: { ip },
          frameBody: sensorInput,
        }),
      );

      if (!decision.allow) {
        const reason = decision.reasons[0] || "DENIED";
        this.logger.warn(`WS sensor deny: ${reason} [${ip}]`);
        client.close(1008, reason);
        return;
      }

      const effect = await this.router.route(frame as any);
      await this.sendEffect(client, effect);
    } catch (err: any) {
      this.logger.error(`WS handler error: ${err.message}`);
      client.close(1011, "INTERNAL_FAILURE");
    }
  }

  /**
   * Override to customise how the intent's effect is framed back to the
   * client (signing, envelope format, etc.). Default serializes the body
   * as JSON text for simplicity.
   */
  protected async sendEffect(
    client: WebSocket,
    effect: { effect?: string; body?: any; headers?: Map<number, Uint8Array> },
  ): Promise<void> {
    if (Buffer.isBuffer(effect.body) || effect.body instanceof Uint8Array) {
      client.send(effect.body);
      return;
    }
    client.send(
      typeof effect.body === "string"
        ? effect.body
        : JSON.stringify(effect.body ?? null),
    );
  }
}
