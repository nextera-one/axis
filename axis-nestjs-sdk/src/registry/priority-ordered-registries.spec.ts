import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PriorityOrder } from "../decorators/priority-order.decorator";
import { ObserverRegistry } from "../observer/observer.registry";
import { SensorRegistry } from "../sensor/sensor.registry";

const PRE_DECODE_BOUNDARY = 40;

@PriorityOrder("HIGH", 0)
class HighObserver {
  readonly name = "HighObserver";

  observe() {}
}

class NeutralObserver {
  readonly name = "NeutralObserver";

  observe() {}
}

@PriorityOrder("LOW", 0)
class LowObserver {
  readonly name = "LowObserver";

  observe() {}
}

@PriorityOrder("HIGH", 0)
class HighPreSensor {
  readonly name = "HighPreSensor";
  readonly order = 30;
  readonly phase = "PRE_DECODE";
}

class NeutralPreSensor {
  readonly name = "NeutralPreSensor";
  readonly order = 10;
  readonly phase = "PRE_DECODE";
}

@PriorityOrder("LOW", 0)
class LowPreSensor {
  readonly name = "LowPreSensor";
  readonly order = 20;
  readonly phase = "PRE_DECODE";
}

@PriorityOrder("HIGH", 0)
class HighPostSensor {
  readonly name = "HighPostSensor";
  readonly order = PRE_DECODE_BOUNDARY + 5;
  readonly phase = "POST_DECODE";
}

describe("ObserverRegistry", () => {
  it("orders observers by PriorityOrder and falls back to name", () => {
    const registry = new ObserverRegistry();

    registry.register(new LowObserver() as any);
    registry.register(new NeutralObserver() as any);
    registry.register(new HighObserver() as any);

    assert.deepEqual(
      registry.list().map((entry) => entry.name),
      ["HighObserver", "NeutralObserver", "LowObserver"],
    );
  });
});

describe("SensorRegistry", () => {
  it("orders sensors by phase, PriorityOrder, then numeric order", () => {
    const registry = new SensorRegistry({
      get: () => undefined,
    } as any);

    registry.register(new NeutralPreSensor() as any);
    registry.register(new LowPreSensor() as any);
    registry.register(new HighPostSensor() as any);
    registry.register(new HighPreSensor() as any);

    assert.deepEqual(
      registry.getPreDecodeSensors().map((sensor) => sensor.name),
      ["HighPreSensor", "NeutralPreSensor", "LowPreSensor"],
    );
    assert.deepEqual(
      registry.getPostDecodeSensors().map((sensor) => sensor.name),
      ["HighPostSensor"],
    );
  });
});
