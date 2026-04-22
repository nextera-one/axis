import type { MiddlewareConsumer, NestMiddleware, Type } from "@nestjs/common";
import {
  getPriorityOrder,
  getPriorityOrderedTargets,
} from "../decorators/priority-order.decorator";

export type AxisNestMiddlewareClass = Type<NestMiddleware>;

function assertOrderedNestMiddleware(
  target: Function,
): asserts target is AxisNestMiddlewareClass {
  if (!getPriorityOrder(target)) {
    throw new Error(
      `${target.name || "<anonymous>"} is missing @PriorityOrder() metadata`,
    );
  }

  if (typeof (target as any)?.prototype?.use !== "function") {
    throw new Error(
      `${target.name || "<anonymous>"} must implement NestMiddleware.use() to be registered as ordered middleware`,
    );
  }
}

function getConsumerContainer(consumer: MiddlewareConsumer): any | null {
  return (consumer as any)?.routesMapper?.container ?? null;
}

function getModuleCandidateTargets(moduleRef: any): Function[] {
  const buckets = [
    moduleRef?.providers,
    moduleRef?.injectables,
    moduleRef?.middlewares,
  ];

  const targets: Function[] = [];
  for (const bucket of buckets) {
    if (!bucket?.values) {
      continue;
    }

    for (const wrapper of bucket.values()) {
      const metatype = wrapper?.metatype;
      if (typeof metatype === "function") {
        targets.push(metatype);
      }
    }
  }

  return targets;
}

function discoverPriorityOrderedMiddlewares(
  consumer: MiddlewareConsumer,
): AxisNestMiddlewareClass[] {
  const container = getConsumerContainer(consumer);
  if (!container?.getModules) {
    return [];
  }

  const discovered = new Set<Function>();
  for (const moduleRef of Array.from(container.getModules().values())) {
    for (const target of getModuleCandidateTargets(moduleRef)) {
      if (!getPriorityOrder(target)) {
        continue;
      }
      if (typeof (target as any)?.prototype?.use !== "function") {
        continue;
      }
      discovered.add(target);
    }
  }

  return getPriorityOrderedTargets(discovered).map((target) => {
    assertOrderedNestMiddleware(target);
    return target;
  });
}

export function resolvePriorityOrderedMiddlewares(
  middlewares?: Iterable<Function | null | undefined | false>,
): AxisNestMiddlewareClass[] {
  const explicit = middlewares
    ? (Array.from(middlewares).filter(Boolean) as Function[])
    : [];
  const ordered =
    explicit.length > 0
      ? getPriorityOrderedTargets(explicit)
      : getPriorityOrderedTargets();
  return ordered.map((target) => {
    assertOrderedNestMiddleware(target);
    return target;
  });
}

export function applyPriorityOrderedMiddlewares(
  consumer: MiddlewareConsumer,
  ...middlewares: Array<Function | null | undefined | false>
) {
  const explicit = middlewares.filter(Boolean);
  const ordered =
    explicit.length > 0
      ? resolvePriorityOrderedMiddlewares(explicit)
      : discoverPriorityOrderedMiddlewares(consumer);
  if (ordered.length === 0) {
    throw new Error(
      explicit.length > 0
        ? "applyPriorityOrderedMiddlewares() requires at least one middleware class"
        : "applyPriorityOrderedMiddlewares() could not find any provider-backed @PriorityOrder() middlewares in the Nest container",
    );
  }
  return consumer.apply(...ordered);
}
