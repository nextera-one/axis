import { Injectable } from "@nestjs/common";
import { ObserverDispatcherService as CoreObserverDispatcherService } from "@nextera.one/axis-server-sdk";

import { ObserverRegistry } from "./observer.registry";

@Injectable()
export class ObserverDispatcherService extends CoreObserverDispatcherService {
  constructor(registry: ObserverRegistry) {
    super(registry);
  }
}
