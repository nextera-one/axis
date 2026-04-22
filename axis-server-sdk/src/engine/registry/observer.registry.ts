import type { AxisObserverDefinition, AxisObserverRef } from "../../decorators/observer.decorator";
import type {
  AxisIntentObserver,
  AxisObserverRegistration,
} from "../axis-observer.interface";
import { createAxisLogger } from "../../utils/axis-logger";

export class ObserverRegistry {
  private readonly logger = createAxisLogger(ObserverRegistry.name);
  private readonly byName = new Map<string, AxisObserverRegistration>();
  private readonly byType = new Map<Function, AxisObserverRegistration>();

  register(
    instance: AxisIntentObserver,
    meta: AxisObserverDefinition = {},
  ): void {
    const name = meta.name || instance.name || instance.constructor.name;
    const registration: AxisObserverRegistration = {
      name,
      instance,
      tags: meta.tags || [],
      events: meta.events,
      intents: meta.intents,
      handlers: meta.handlers,
    };

    this.byName.set(name, registration);
    this.byType.set(instance.constructor, registration);
    this.logger.debug(`Registered observer: ${name}`);
  }

  resolve(ref: AxisObserverRef): AxisObserverRegistration | undefined {
    if (typeof ref === "string") {
      return this.byName.get(ref);
    }

    return this.byType.get(ref) || this.byName.get(ref.name);
  }

  list(): AxisObserverRegistration[] {
    return Array.from(this.byName.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  clear(): void {
    this.byName.clear();
    this.byType.clear();
  }
}
