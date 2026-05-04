import type {
  AxisPostSensor,
  AxisPreSensor,
  AxisSensor,
} from "../../sensor/axis-sensor";
import type { AxisIntentSensorRef } from "../../decorators/intent.decorator";
import { createAxisLogger } from "../../utils/axis-logger";

export interface AxisConfigReader {
  get<T = string>(key: string): T | undefined;
}

/**
 * AxisSensor Registry
 *
 * A central registry for all AXIS security sensors.
 */
export class SensorRegistry {
  private sensors: AxisSensor[] = [];
  private sensorsByName = new Map<string, AxisSensor>();
  private sensorsByType = new Map<Function, AxisSensor>();
  private readonly logger = createAxisLogger(SensorRegistry.name);

  constructor(private readonly configService?: AxisConfigReader) {}

  register(sensor: AxisSensor): void {
    if (!sensor.name) {
      throw new Error("AxisSensor must have a name");
    }

    const enabledSensorsStr =
      this.configService?.get<string>("ENABLED_SENSORS");
    const disabledSensorsStr =
      this.configService?.get<string>("DISABLED_SENSORS");

    const enabledSensors = enabledSensorsStr
      ? enabledSensorsStr.split(",").map((s) => s.trim())
      : null;
    const disabledSensors = disabledSensorsStr
      ? disabledSensorsStr.split(",").map((s) => s.trim())
      : [];

    if (enabledSensors && !enabledSensors.includes(sensor.name)) {
      this.logger.log(
        `Skipping disabled sensor (not in ENABLED_SENSORS): ${sensor.name}`,
      );
      return;
    }

    if (disabledSensors.includes(sensor.name)) {
      this.logger.log(
        `Skipping disabled sensor (in DISABLED_SENSORS): ${sensor.name}`,
      );
      return;
    }

    if (sensor.order === undefined) {
      throw new Error(`AxisSensor "${sensor.name}" must have an order field`);
    }

    const isPreDecodeSensor = this.isPreDecodeSensor(sensor);
    const isPostDecodeSensor = this.isPostDecodeSensor(sensor);

    if (isPreDecodeSensor && sensor.order >= 40) {
      this.logger.warn(
        `AxisSensor "${sensor.name}" is marked as PRE_DECODE but has order ${sensor.order} (should be < 40)`,
      );
    }
    if (isPostDecodeSensor && sensor.order < 40) {
      this.logger.warn(
        `AxisSensor "${sensor.name}" is marked as POST_DECODE but has order ${sensor.order} (should be >= 40)`,
      );
    }

    this.sensors.push(sensor);
    this.indexSensor(sensor);
    const phaseLabel =
      typeof sensor.phase === "string"
        ? sensor.phase
        : sensor.phase?.phase || "UNKNOWN";
    this.logger.debug(
      `Registered sensor: ${sensor.name} (order: ${sensor.order}, phase: ${phaseLabel})`,
    );
  }

  list(): AxisSensor[] {
    return [...this.sensors].sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999),
    );
  }

  resolve(ref: AxisIntentSensorRef): AxisSensor | undefined {
    if (typeof ref === "string") {
      return this.sensorsByName.get(ref);
    }
    return this.sensorsByType.get(ref) ?? this.sensorsByName.get(ref.name);
  }

  getByName(name: string): AxisSensor | undefined {
    return this.sensorsByName.get(name);
  }

  getPreDecodeSensors(): AxisPreSensor[] {
    return this.list().filter((s): s is AxisPreSensor =>
      this.isPreDecodeSensor(s),
    );
  }

  getPostDecodeSensors(): AxisPostSensor[] {
    return this.list().filter((s): s is AxisPostSensor =>
      this.isPostDecodeSensor(s),
    );
  }

  getSensorCountByPhase(): { preDecodeCount: number; postDecodeCount: number } {
    return {
      preDecodeCount: this.getPreDecodeSensors().length,
      postDecodeCount: this.getPostDecodeSensors().length,
    };
  }

  clear(): void {
    this.sensors = [];
    this.sensorsByName.clear();
    this.sensorsByType.clear();
  }

  private isPreDecodeSensor(sensor: AxisSensor): boolean {
    const phase =
      typeof sensor.phase === "string" ? sensor.phase : sensor.phase?.phase;
    // Explicit phase metadata is authoritative; order is only the fallback.
    if (phase) return phase === "PRE_DECODE";
    return (sensor.order ?? 999) < 40;
  }

  private isPostDecodeSensor(sensor: AxisSensor): boolean {
    const phase =
      typeof sensor.phase === "string" ? sensor.phase : sensor.phase?.phase;
    // Explicit phase metadata is authoritative; order is only the fallback.
    if (phase) return phase === "POST_DECODE";
    return (sensor.order ?? 999) >= 40;
  }

  private indexSensor(sensor: AxisSensor): void {
    this.sensorsByName.set(sensor.name, sensor);

    const sensorType = sensor.constructor as Function | undefined;
    if (!sensorType) return;

    this.sensorsByType.set(sensorType, sensor);

    if (!this.sensorsByName.has(sensorType.name)) {
      this.sensorsByName.set(sensorType.name, sensor);
    }
  }
}
