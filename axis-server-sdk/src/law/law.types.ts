import type { SensorInput } from "../sensor/axis-sensor";

export type AxisLawDecision = "allow" | "deny" | "conditional";

export interface AxisLawArticleSummary {
  article_id: string;
  article_type?: string;
  decision?: string;
  reason?: string;
}

export interface AxisLawEvaluationContext {
  actorId?: string;
  intent?: string;
  audience?: string;
  tps?: string | number;
  country?: string;
  ip?: string;
  path?: string;
  clientId?: string;
  deviceId?: string;
  sessionId?: string;
  capsuleId?: string;
  metadata: Record<string, unknown>;
  packet?: Record<string, unknown>;
  frameBody?: unknown;
}

export interface AxisLawEvaluationResult {
  decision: AxisLawDecision;
  reason: string;
  explanation?: string;
  denied?: AxisLawArticleSummary[];
  permitted?: AxisLawArticleSummary[];
  required?: AxisLawArticleSummary[];
  applicable?: AxisLawArticleSummary[];
  metadata?: Record<string, unknown>;
}

export type AxisLawEvaluator =
  | ((
      context: AxisLawEvaluationContext,
    ) => AxisLawEvaluationResult | Promise<AxisLawEvaluationResult>);

export interface LawEvaluationSensorOptions {
  evaluator?: AxisLawEvaluator;
  conditionalDecision?: "deny" | "flag" | "allow";
}

export function buildAxisLawEvaluationContext(
  input: SensorInput,
): AxisLawEvaluationContext {
  const metadata = (input.metadata ?? {}) as Record<string, unknown>;
  const packet = input.packet as Record<string, unknown> | undefined;
  const packetBody =
    input.frameBody ??
    (packet?.body as unknown) ??
    (packet?.args as unknown) ??
    undefined;
  const capsuleId =
    (metadata.capsule_id as string | undefined) ??
    (metadata.capsuleId as string | undefined) ??
    (packet?.capsuleId as string | undefined) ??
    (input.clientId as string | undefined);
  const audience =
    (input.aud as string | undefined) ??
    (metadata.audience as string | undefined) ??
    (packet?.aud as string | undefined);
  const tps =
    (metadata.tps as string | number | undefined) ??
    (packet?.tps as string | number | undefined) ??
    (packet?.tickTps as string | number | undefined);

  return {
    actorId: input.actorId,
    intent: input.intent,
    audience,
    tps,
    country: input.country,
    ip: input.ip,
    path: input.path,
    clientId: input.clientId,
    deviceId: input.deviceId,
    sessionId: input.sessionId,
    capsuleId,
    metadata,
    packet,
    frameBody: packetBody,
  };
}
