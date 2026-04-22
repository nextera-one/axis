import { Injectable, Optional } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { IntentRouter as CoreIntentRouter } from "@nextera.one/axis-server-sdk";

import { ObserverDispatcherService } from "../observer/observer-dispatcher.service";
import { SensorRegistry } from "../sensor/sensor.registry";

@Injectable()
export class IntentRouter extends CoreIntentRouter {
  constructor(
    @Optional() moduleRef?: ModuleRef,
    @Optional() observerDispatcher?: ObserverDispatcherService,
    @Optional() sensorRegistry?: SensorRegistry,
  ) {
    super(
      moduleRef
        ? {
            resolve: (token) => {
              try {
                return moduleRef.get(token as never, { strict: false });
              } catch {
                return undefined;
              }
            },
          }
        : undefined,
      observerDispatcher,
      sensorRegistry,
    );
  }
}
