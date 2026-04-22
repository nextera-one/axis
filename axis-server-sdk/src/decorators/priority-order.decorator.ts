import "reflect-metadata";

export const PRIORITY_ORDER_METADATA_KEY = "axis:priority-order";

export type AxisPriorityLevel = "HIGH" | "MEDIUM" | "LOW";
export type AxisPriorityLevelInput =
  | AxisPriorityLevel
  | "high"
  | "medium"
  | "low"
  | "High"
  | "Medium"
  | "Low";

export interface PriorityOrderDefinition {
  priority: AxisPriorityLevel;
  order: number;
}

export interface PriorityOrderOptions {
  priority?: AxisPriorityLevelInput;
  order?: number;
}

const PRIORITY_ORDER_WEIGHT: Record<AxisPriorityLevel, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const priorityOrderRegistry = new Set<Function>();

function normalizePriority(priority: AxisPriorityLevelInput): AxisPriorityLevel {
  const normalized = String(priority).toUpperCase();
  if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
    return normalized;
  }
  throw new Error(
    `@PriorityOrder() received invalid priority "${String(priority)}"`,
  );
}

function normalizeOrder(order: unknown): number {
  if (
    typeof order !== "number" ||
    !Number.isInteger(order) ||
    !Number.isFinite(order) ||
    order < 0
  ) {
    throw new Error(
      `@PriorityOrder() requires a non-negative integer order, received "${String(order)}"`,
    );
  }
  return order;
}

function isPriorityOrderOptions(
  value: AxisPriorityLevelInput | PriorityOrderOptions | undefined,
): value is PriorityOrderOptions {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolvePriorityOrder(
  priorityOrOptions?: AxisPriorityLevelInput | PriorityOrderOptions,
  order = 0,
): PriorityOrderDefinition {
  if (isPriorityOrderOptions(priorityOrOptions)) {
    return {
      priority: normalizePriority(priorityOrOptions.priority ?? "MEDIUM"),
      order: normalizeOrder(priorityOrOptions.order ?? 0),
    };
  }

  return {
    priority: normalizePriority(priorityOrOptions ?? "MEDIUM"),
    order: normalizeOrder(order),
  };
}

export function getPriorityOrder(
  target: Function,
): PriorityOrderDefinition | null {
  return (
    Reflect.getMetadata(PRIORITY_ORDER_METADATA_KEY, target) ?? null
  );
}

export function comparePriorityOrder(
  left: PriorityOrderDefinition,
  right: PriorityOrderDefinition,
): number {
  const priorityDelta =
    PRIORITY_ORDER_WEIGHT[left.priority] - PRIORITY_ORDER_WEIGHT[right.priority];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  return left.order - right.order;
}

export function getPriorityOrderedTargets(
  targets?: Iterable<Function>,
): Function[] {
  const pool = targets ? Array.from(targets) : Array.from(priorityOrderRegistry);

  return pool.sort((left, right) => {
    const leftMeta = getPriorityOrder(left);
    const rightMeta = getPriorityOrder(right);

    if (!leftMeta && !rightMeta) {
      return (left.name || "").localeCompare(right.name || "");
    }
    if (!leftMeta) return 1;
    if (!rightMeta) return -1;

    const ordered = comparePriorityOrder(leftMeta, rightMeta);
    if (ordered !== 0) {
      return ordered;
    }

    return (left.name || "").localeCompare(right.name || "");
  });
}

export function PriorityOrder(
  priorityOrOptions?: AxisPriorityLevelInput | PriorityOrderOptions,
  order = 0,
): ClassDecorator {
  const definition = resolvePriorityOrder(priorityOrOptions, order);

  return (target: Function) => {
    Reflect.defineMetadata(PRIORITY_ORDER_METADATA_KEY, definition, target);
    priorityOrderRegistry.add(target);
  };
}

export const priorityOrder = PriorityOrder;
