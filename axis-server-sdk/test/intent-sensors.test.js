require("reflect-metadata");

const test = require("node:test");
const assert = require("node:assert/strict");

const { ConfigService } = require("@nestjs/config");

const {
  Intent,
  IntentRouter,
  IntentSensors,
  SensorDecisions,
  SensorRegistry,
  TLV_INTENT,
} = require("../dist");

class NamedGateSensor {
  constructor() {
    this.name = "IntentNamedGate";
    this.order = 95;
    this.phase = "POST_DECODE";
  }

  async run() {
    return SensorDecisions.deny("NAMED_BLOCKED");
  }
}

class LegacyGateSensor {
  constructor() {
    this.name = "LegacyGateSensor";
    this.order = 96;
    this.phase = "POST_DECODE";
  }

  async run() {
    return SensorDecisions.deny("LEGACY_BLOCKED");
  }
}

class IntentOptionHandler {
  async inspect(body) {
    return body;
  }
}

class LegacyDecoratorHandler {
  async inspect(body) {
    return body;
  }
}

Intent("sdk.intent.option", {
  absolute: true,
  is: ["IntentNamedGate"],
})(IntentOptionHandler.prototype, "inspect");

Intent("sdk.intent.legacy", {
  absolute: true,
})(LegacyDecoratorHandler.prototype, "inspect");
IntentSensors([LegacyGateSensor])(
  LegacyDecoratorHandler.prototype,
  "inspect",
);

function createFrame(intent, body = Buffer.from("payload")) {
  return {
    headers: new Map([[TLV_INTENT, Buffer.from(intent, "utf8")]]),
    body,
  };
}

test("Intent option `is` resolves sensors by registry name", async () => {
  const registry = new SensorRegistry(new ConfigService());
  registry.register(new NamedGateSensor());

  const router = new IntentRouter(undefined, undefined, registry);
  router.registerHandler(new IntentOptionHandler());

  await assert.rejects(
    () => router.route(createFrame("sdk.intent.option")),
    /SENSOR_DENY:NAMED_BLOCKED/,
  );
});

test("IntentSensors keeps backward compatibility with class refs", async () => {
  const registry = new SensorRegistry(new ConfigService());
  registry.register(new LegacyGateSensor());

  const router = new IntentRouter(undefined, undefined, registry);
  router.registerHandler(new LegacyDecoratorHandler());

  await assert.rejects(
    () => router.route(createFrame("sdk.intent.legacy")),
    /SENSOR_DENY:LEGACY_BLOCKED/,
  );
});

test("Missing intent sensor refs fail closed", async () => {
  const registry = new SensorRegistry(new ConfigService());
  const router = new IntentRouter(undefined, undefined, registry);
  router.registerHandler(new IntentOptionHandler());

  await assert.rejects(
    () => router.route(createFrame("sdk.intent.option")),
    /SENSOR_MISSING:IntentNamedGate/,
  );
});
