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
  const ordered = resolvePriorityOrderedMiddlewares(middlewares);
  if (ordered.length === 0) {
    throw new Error(
      "applyPriorityOrderedMiddlewares() requires at least one middleware class",
    );
  }
  return consumer.apply(...ordered);
}
