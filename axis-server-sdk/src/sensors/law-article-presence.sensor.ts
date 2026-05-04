import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../sensor/axis-sensor";

export type LawArticlePresenceMode = "off" | "audit" | "strict";

export interface LawArticlePresenceSensorOptions {
  mode?: LawArticlePresenceMode | (() => LawArticlePresenceMode);
  exemptIntents?: string[];
  missingCode?: string;
  auditScoreDelta?: number;
  getLawArticleCount: (
    intent: string,
    input: SensorInput,
  ) => number | Promise<number>;
}

/**
 * Checks whether an intent has at least one mapped law article.
 *
 * Storage stays outside the SDK: callers provide `getLawArticleCount()`.
 */
@Sensor({ phase: "POST_DECODE" })
export class LawArticlePresenceSensor implements AxisSensor {
  readonly name = "LawArticlePresenceSensor";
  readonly order = BAND.IDENTITY + 27;

  constructor(private readonly options: LawArticlePresenceSensorOptions) {}

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    if (this.mode() === "off") return false;
    if (!input.intent) return false;
    if (this.exemptIntents().includes(input.intent)) return false;
    return true;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    const intent = input.intent!;
    const count = await this.options.getLawArticleCount(intent, input);

    if (count > 0) {
      return {
        action: "ALLOW",
        meta: { lawArticles: count },
      };
    }

    const reason = `Intent '${intent}' has no law article mapping`;
    if (this.mode() === "strict") {
      return {
        action: "DENY",
        code: this.options.missingCode ?? "CAPSULE_NOT_LAWFUL",
        reason,
      };
    }

    return {
      action: "FLAG",
      scoreDelta: this.options.auditScoreDelta ?? 5,
      reasons: ["LAW_ARTICLE_MISSING", reason],
      meta: { lawArticles: 0 },
    };
  }

  private mode(): LawArticlePresenceMode {
    const configured = this.options.mode;
    if (typeof configured === "function") return configured();
    return configured ?? "audit";
  }

  private exemptIntents(): string[] {
    return this.options.exemptIntents ?? ["system.ping"];
  }
}
