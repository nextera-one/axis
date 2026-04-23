import { ObserverRegistry as CoreObserverRegistry } from "@nextera.one/axis-server-sdk";
import type { AxisSensor } from "@nextera.one/axis-server-sdk";

import {
  comparePriorityOrder,
  getPriorityOrder,
  type PriorityOrderDefinition,
} from "../decorators/priority-order.decorator";

const PRE_DECODE_BOUNDARY = 40;

const DEFAULT_PRIORITY: PriorityOrderDefinition = {
  priority: "MEDIUM",
  order: 0,
};

export type ObserverRegistration = ReturnType<
  CoreObserverRegistry["list"]
>[number];

function getNormalizedPriority(
  target?: Function | null,
): PriorityOrderDefinition {
  if (!target) return DEFAULT_PRIORITY;
  return getPriorityOrder(target) ?? DEFAULT_PRIORITY;
}

function compareTargetsByPriority(
  left?: Function | null,
  right?: Function | null,
): number {
  return comparePriorityOrder(
    getNormalizedPriority(left),
    getNormalizedPriority(right),
  );
}

function getSensorPhaseRank(sensor: AxisSensor): number {
  const phase =
    typeof sensor.phase === "string" ? sensor.phase : sensor.phase?.phase;

  if (phase === "PRE_DECODE") return 0;
  if (phase === "POST_DECODE") return 1;

  return (sensor.order ?? PRE_DECODE_BOUNDARY) < PRE_DECODE_BOUNDARY ? 0 : 1;
}

export function compareSensorsByPriority(
  left: AxisSensor,
  right: AxisSensor,
): number {
  const phaseDelta = getSensorPhaseRank(left) - getSensorPhaseRank(right);
  if (phaseDelta !== 0) return phaseDelta;

  const priorityDelta = compareTargetsByPriority(
    left.constructor,
    right.constructor,
  );
  if (priorityDelta !== 0) return priorityDelta;

  const orderDelta = (left.order ?? 999) - (right.order ?? 999);
  if (orderDelta !== 0) return orderDelta;

  return (left.name || "").localeCompare(right.name || "");
}

export function compareObserverRegistrationsByPriority(
  left: ObserverRegistration,
  right: ObserverRegistration,
): number {
  const priorityDelta = compareTargetsByPriority(
    left.instance?.constructor,
    right.instance?.constructor,
  );
  if (priorityDelta !== 0) return priorityDelta;

  return left.name.localeCompare(right.name);
}
