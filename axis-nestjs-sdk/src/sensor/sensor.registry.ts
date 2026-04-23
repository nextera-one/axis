import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SensorRegistry as CoreSensorRegistry } from "@nextera.one/axis-server-sdk";

import { compareSensorsByPriority } from "../registry/priority-ordered-registries";

@Injectable()
export class SensorRegistry extends CoreSensorRegistry {
  constructor(configService: ConfigService) {
    super(configService);
  }

  list() {
    return super.list().sort(compareSensorsByPriority);
  }
}
