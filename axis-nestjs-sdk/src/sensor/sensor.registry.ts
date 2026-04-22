import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SensorRegistry as CoreSensorRegistry } from "@nextera.one/axis-server-sdk";

@Injectable()
export class SensorRegistry extends CoreSensorRegistry {
  constructor(configService: ConfigService) {
    super(configService);
  }
}
