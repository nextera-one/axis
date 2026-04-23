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
    const explicitBindings = bindings || [];
    const implicitRegistrations = this.getImplicitRegistrations();

    if (!explicitBindings.length && implicitRegistrations.length === 0) {
      return;
    }

    const invoked = new Set<string>();

    const implicitBindings: AxisObserverBinding[] = implicitRegistrations.map(
      (registration) => ({
        refs: [registration.instance.constructor],
        events: registration.events,
      }),
    );

    const merged = mergeBindingRefs(explicitBindings, implicitBindings);

    for (const binding of merged) {
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
          !matchesObserverIntent(registration.intents, context.intent) ||
          !matchesObserverHandler(registration.handlers, context.handler)
        ) {
          continue;
        }

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

  private getImplicitRegistrations() {
    return this.registry.list();
  }
}

function matchesObserverIntent(
  intents: string[] | undefined,
  intent?: string,
): boolean {
  if (!intents || intents.length === 0) {
    return true;
  }

  if (!intent) {
    return false;
  }

  return intents.includes(intent);
}

function normalizeHandlerToken(value: string): string {
  return value.trim().toLowerCase();
}

function matchesObserverHandler(
  handlers: string[] | undefined,
  handler?: string,
): boolean {
  if (!handlers || handlers.length === 0) {
    return true;
  }

  if (!handler) {
    return false;
  }

  const normalizedHandler = normalizeHandlerToken(handler);
  return handlers.some((candidate) => {
    if (!candidate) {
      return false;
    }

    const normalizedCandidate = normalizeHandlerToken(candidate);
    return (
      normalizedHandler === normalizedCandidate ||
      normalizedHandler.endsWith(`.${normalizedCandidate}`) ||
      normalizedHandler.startsWith(`${normalizedCandidate}.`) ||
      normalizedCandidate.endsWith(`.${normalizedHandler}`) ||
      normalizedCandidate.startsWith(`${normalizedHandler}.`)
    );
  });
}

function observerRefKey(ref: { name?: string } | string | Function): string {
  return typeof ref === "string" ? ref : ref.name || "(anonymous)";
}

function mergeBindingRefs(
  ...bindingGroups: AxisObserverBinding[][]
): AxisObserverBinding[] {
  const merged = new Map<string, AxisObserverBinding>();

  for (const bindings of bindingGroups) {
    for (const binding of bindings) {
      for (const ref of binding.refs) {
        const key = observerRefKey(ref);
        const current = merged.get(key);

        if (!current) {
          merged.set(key, {
            refs: [ref],
            tags: binding.tags ? [...new Set(binding.tags)] : undefined,
            events: binding.events ? [...new Set(binding.events)] : undefined,
          });
          continue;
        }

        current.tags = Array.from(
          new Set([...(current.tags || []), ...(binding.tags || [])]),
        );
        current.events =
          current.events === undefined || binding.events === undefined
            ? undefined
            : Array.from(new Set([...(current.events || []), ...binding.events]));
      }
    }
  }

  return Array.from(merged.values());
}
