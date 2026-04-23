import { Injectable } from "@nestjs/common";
import { ObserverRegistry as CoreObserverRegistry } from "@nextera.one/axis-server-sdk";

import { compareObserverRegistrationsByPriority } from "../registry/priority-ordered-registries";

@Injectable()
export class ObserverRegistry extends CoreObserverRegistry {
  list() {
    return super.list().sort(compareObserverRegistrationsByPriority);
  }
}
