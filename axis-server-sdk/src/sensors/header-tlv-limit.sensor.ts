import { Sensor } from "../decorators/sensor.decorator";
import { MAX_HDR_LEN } from "../core/constants";
import { BAND } from "../engine/sensor-bands";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";

@Sensor()
export class HeaderTLVLimitSensor implements AxisSensor {
  readonly name = "HeaderTLVLimitSensor";
  readonly order = BAND.CONTENT + 0;
  private readonly MAX_TLVS = 64;

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    return !!input.headerTLVs || !!input.packet;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    if (input.headerTLVs && input.headerTLVs.size > this.MAX_TLVS) {
      return {
        action: "DENY",
        code: "TOO_MANY_TLVS",
        reason: `Header TLVs (${input.headerTLVs.size}) exceed max (${this.MAX_TLVS})`,
      };
    }

    if (input.packet && input.packet.headerBytes) {
      const hdrLen = input.packet.headerBytes.length;
      if (hdrLen > MAX_HDR_LEN) {
        return {
          action: "DENY",
          code: "HEADER_TOO_LARGE",
          reason: `Header size ${hdrLen} exceeds max ${MAX_HDR_LEN}`,
        };
      }
    }

    return { action: "ALLOW" };
  }
}
