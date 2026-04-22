import type { AxisObserverBinding } from "../decorators/observer.decorator";
import type { AxisObserverContext } from "./axis-observer.interface";
import { ObserverRegistry } from "./registry/observer.registry";
import { createAxisLogger } from "../utils/axis-logger";

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export class ObserverDispatcherService {
  private readonly logger = createAxisLogger(ObserverDispatcherService.name);

  constructor(private readonly registry: ObserverRegistry) {}

  async dispatch(
    bindings: AxisObserverBinding[] | undefined,
    context: AxisObserverContext,
  ): Promise<void> {
    if (!bindings || bindings.length === 0) return;

    const invoked = new Set<string>();

    for (const binding of bindings) {
      if (
        binding.events &&
        binding.events.length > 0 &&
        !binding.events.includes(context.event)
      ) {
        continue;
      }

      for (const ref of binding.refs) {
        const registration = this.registry.resolve(ref);
        if (!registration) {
          this.logger.warn(`Observer ${String(ref)} could not be resolved`);
          continue;
        }

        if (invoked.has(registration.name)) continue;

        if (
          registration.events &&
          registration.events.length > 0 &&
          !registration.events.includes(context.event)
        ) {
          continue;
        }

        const observerContext: AxisObserverContext = {
          ...context,
          observerTags: unique([
            ...(registration.tags || []),
            ...(binding.tags || []),
            ...(context.observerTags || []),
          ]),
        };

        if (
          registration.instance.supports &&
          !registration.instance.supports(observerContext)
        ) {
          continue;
        }

        try {
          invoked.add(registration.name);
          await registration.instance.observe(observerContext);
        } catch (error: any) {
          this.logger.warn(
            `Observer ${registration.name} failed during ${context.event}: ${error.message}`,
          );
        }
      }
    }
  }
}
