import { Injectable } from "@nestjs/common";

import {
  AxisSensorChainService as CoreAxisSensorChainService,
  SensorDecision,
  SensorInput,
} from "@nextera.one/axis-server-sdk";
import { SensorRegistry } from "./sensor.registry";

export { SensorInput, SensorDecision }; // Re-export for convenience

@Injectable()
export class AxisSensorChainService extends CoreAxisSensorChainService {
  constructor(registry: SensorRegistry) {
    super(registry);
  }
}
