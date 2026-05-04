const test = require("node:test");
const assert = require("node:assert/strict");

const { SensorRegistry, SensorDecisions } = require("../dist");

class ExplicitPreDecodeHighOrderSensor {
  constructor() {
    this.name = "ExplicitPreDecodeHighOrderSensor";
    this.order = 80;
    this.phase = "PRE_DECODE";
  }

  async run() {
    return SensorDecisions.allow();
  }
}

class ExplicitPostDecodeLowOrderSensor {
  constructor() {
    this.name = "ExplicitPostDecodeLowOrderSensor";
    this.order = 10;
    this.phase = "POST_DECODE";
  }

  async run() {
    return SensorDecisions.allow();
  }
}

test("SensorRegistry uses explicit phase before order fallback", () => {
  const registry = new SensorRegistry();
  const pre = new ExplicitPreDecodeHighOrderSensor();
  const post = new ExplicitPostDecodeLowOrderSensor();

  registry.register(pre);
  registry.register(post);

  assert.deepEqual(registry.getPreDecodeSensors(), [pre]);
  assert.deepEqual(registry.getPostDecodeSensors(), [post]);
});
