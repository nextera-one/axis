require("reflect-metadata");

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AxisAnonymous,
  AxisAuthorized,
  AxisPublic,
  Capsule,
  Handler,
  Intent,
  IntentRouter,
  IntentSensors,
  ObserverDispatcherService,
  ObserverRegistry,
  RequiredProof,
  Sensitivity,
  SensorDecisions,
  SensorRegistry,
  TLV_INTENT,
  Witness,
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

class AfterGateSensor {
  constructor() {
    this.name = "AfterGateSensor";
    this.order = 97;
    this.phase = "POST_DECODE";
  }

  supports(input) {
    return input?.metadata?.stage === "after";
  }

  async run(input) {
    if (input?.metadata?.effect?.effect === "complete") {
      return SensorDecisions.deny("AFTER_BLOCKED");
    }

    return SensorDecisions.allow();
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

class IntentSensitivityHandler {
  async inspect(body) {
    return body;
  }
}

class LegacySensitivityHandler {
  async inspect(body) {
    return body;
  }
}

class AfterStageHandler {
  async inspect(body) {
    return body;
  }
}

class HandlerObserveHandler {
  async inspect(body) {
    return body;
  }
}

class AuthAliasHandler {
  async issue(body) {
    return body;
  }
}

class ProofPolicyHandler {
  async classDefault(body) {
    return body;
  }

  async publicAccess(body) {
    return body;
  }

  async anonymousAccess(body) {
    return body;
  }

  async authorizedShortcut(body) {
    return body;
  }

  async authorizedProof(body) {
    return body;
  }

  async capsuleProof(body) {
    return body;
  }

  async witnessProof(body) {
    return body;
  }
}

class CustomPingHandler {
  async ping() {
    return Buffer.from(JSON.stringify({ ok: true, source: "app" }));
  }
}

class HandlerObserveProbe {
  constructor(events) {
    this.name = "HandlerObserveProbe";
    this.events = events;
  }

  async observe(context) {
    this.events.push(context.event);
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

Sensitivity("LOW")(IntentSensitivityHandler);
Intent("sdk.intent.sensitivity", {
  absolute: true,
  sensitivity: "CRITICAL",
})(IntentSensitivityHandler.prototype, "inspect");

Sensitivity("HIGH")(LegacySensitivityHandler.prototype, "inspect");
Intent("sdk.intent.legacy-sensitivity", {
  absolute: true,
})(LegacySensitivityHandler.prototype, "inspect");

Handler("sdk.intent.after-handler")(AfterStageHandler);
Intent("after", {
  is: [{ use: AfterGateSensor, when: "after" }],
})(AfterStageHandler.prototype, "inspect");

Handler("sdk.handler.observe", {
  observe: [HandlerObserveProbe],
})(HandlerObserveHandler);
Intent("inspect")(HandlerObserveHandler.prototype, "inspect");

Handler("auth")(AuthAliasHandler);
AxisPublic()(
  AuthAliasHandler.prototype,
  "issue",
  Object.getOwnPropertyDescriptor(AuthAliasHandler.prototype, "issue"),
);
Intent("capsule.issue")(AuthAliasHandler.prototype, "issue");

Handler("proof.policy")(ProofPolicyHandler);
RequiredProof(["NONE"])(ProofPolicyHandler);
Intent("class-default")(ProofPolicyHandler.prototype, "classDefault");
AxisPublic()(
  ProofPolicyHandler.prototype,
  "publicAccess",
  Object.getOwnPropertyDescriptor(ProofPolicyHandler.prototype, "publicAccess"),
);
Intent("public")(ProofPolicyHandler.prototype, "publicAccess");
AxisAnonymous()(
  ProofPolicyHandler.prototype,
  "anonymousAccess",
  Object.getOwnPropertyDescriptor(
    ProofPolicyHandler.prototype,
    "anonymousAccess",
  ),
);
Intent("anonymous")(ProofPolicyHandler.prototype, "anonymousAccess");
AxisAuthorized()(
  ProofPolicyHandler.prototype,
  "authorizedShortcut",
  Object.getOwnPropertyDescriptor(
    ProofPolicyHandler.prototype,
    "authorizedShortcut",
  ),
);
Intent("authorized-shortcut")(
  ProofPolicyHandler.prototype,
  "authorizedShortcut",
);
RequiredProof(["AUTHORIZED"])(
  ProofPolicyHandler.prototype,
  "authorizedProof",
);
Intent("authorized-proof")(ProofPolicyHandler.prototype, "authorizedProof");
Capsule()(ProofPolicyHandler.prototype, "capsuleProof");
Intent("capsule")(ProofPolicyHandler.prototype, "capsuleProof");
Witness()(ProofPolicyHandler.prototype, "witnessProof");
Intent("witness")(ProofPolicyHandler.prototype, "witnessProof");

AxisPublic()(
  CustomPingHandler.prototype,
  "ping",
  Object.getOwnPropertyDescriptor(CustomPingHandler.prototype, "ping"),
);
Intent("system.ping", {
  absolute: true,
})(CustomPingHandler.prototype, "ping");

function createFrame(intent, body = Buffer.from("payload")) {
  return {
    headers: new Map([[TLV_INTENT, Buffer.from(intent, "utf8")]]),
    body,
  };
}

test("Intent option `is` resolves sensors by registry name", async () => {
  const registry = new SensorRegistry();
  registry.register(new NamedGateSensor());

  const router = new IntentRouter(undefined, undefined, registry);
  router.registerHandler(new IntentOptionHandler());

  await assert.rejects(
    () => router.route(createFrame("sdk.intent.option")),
    /SENSOR_DENY:NAMED_BLOCKED/,
  );
});

test("IntentSensors keeps backward compatibility with class refs", async () => {
  const registry = new SensorRegistry();
  registry.register(new LegacyGateSensor());

  const router = new IntentRouter(undefined, undefined, registry);
  router.registerHandler(new LegacyDecoratorHandler());

  await assert.rejects(
    () => router.route(createFrame("sdk.intent.legacy")),
    /SENSOR_DENY:LEGACY_BLOCKED/,
  );
});

test("Missing intent sensor refs fail closed", async () => {
  const registry = new SensorRegistry();
  const router = new IntentRouter(undefined, undefined, registry);
  router.registerHandler(new IntentOptionHandler());

  await assert.rejects(
    () => router.route(createFrame("sdk.intent.option")),
    /SENSOR_MISSING:IntentNamedGate/,
  );
});

test("Intent option `is` supports after-stage sensors", async () => {
  const registry = new SensorRegistry();
  registry.register(new AfterGateSensor());

  const router = new IntentRouter(undefined, undefined, registry);
  router.registerHandler(new AfterStageHandler());

  await assert.rejects(
    () => router.route(createFrame("sdk.intent.after-handler.after")),
    /SENSOR_DENY:AFTER_BLOCKED/,
  );
});

test("Handler option `observe` binds handler-level observers", async () => {
  const seen = [];
  const observerRegistry = new ObserverRegistry();
  observerRegistry.register(new HandlerObserveProbe(seen));
  const dispatcher = new ObserverDispatcherService(observerRegistry);

  const router = new IntentRouter(undefined, dispatcher);
  router.registerHandler(new HandlerObserveHandler());

  await router.route(createFrame("sdk.handler.observe.inspect"));

  assert.deepEqual(seen, ["intent.received", "intent.completed"]);
});

test("Intent option `sensitivity` overrides class-level sensitivity metadata", () => {
  const router = new IntentRouter();
  router.registerHandler(new IntentSensitivityHandler());

  assert.equal(router.getSensitivity("sdk.intent.sensitivity"), "CRITICAL");
});

test("Sensitivity decorator remains backward compatible", () => {
  const router = new IntentRouter();
  router.registerHandler(new LegacySensitivityHandler());

  assert.equal(router.getSensitivity("sdk.intent.legacy-sensitivity"), "HIGH");
});

test("handler triple-dot intent aliases resolve to canonical intent", async () => {
  const router = new IntentRouter();
  router.registerHandler(new AuthAliasHandler());

  assert.equal(
    router.resolveIntentAlias("auth...capsule.issue"),
    "auth.capsule.issue",
  );
  assert.equal(router.has("auth...capsule.issue"), true);
  assert.equal(router.isPublic("auth...capsule.issue"), true);
  assert.equal(
    router.getHandlerByIntent("auth...capsule.issue"),
    "AuthAliasHandler",
  );

  const effect = await router.route(createFrame("auth...capsule.issue"));
  assert.equal(effect.ok, true);
  assert.deepEqual(Buffer.from(effect.body), Buffer.from("payload"));
});

test("registered handlers override simple built-in intents", async () => {
  const router = new IntentRouter();
  router.registerHandler(new CustomPingHandler());

  const effect = await router.route(createFrame("system.ping"));

  assert.equal(effect.ok, true);
  assert.equal(effect.effect, "complete");
  assert.deepEqual(JSON.parse(Buffer.from(effect.body).toString("utf8")), {
    ok: true,
    source: "app",
  });
});

test("proof shorthand decorators resolve to effective RequiredProof kinds", () => {
  const router = new IntentRouter();
  router.registerHandler(new ProofPolicyHandler());

  assert.deepEqual(router.getRequiredProof("proof.policy.class-default"), [
    "NONE",
  ]);
  assert.equal(router.isPublic("proof.policy.class-default"), true);

  assert.deepEqual(router.getRequiredProof("proof.policy.public"), ["NONE"]);
  assert.equal(router.isPublic("proof.policy.public"), true);

  assert.deepEqual(router.getRequiredProof("proof.policy.anonymous"), [
    "ANONYMOUS",
  ]);
  assert.equal(router.isAnonymous("proof.policy.anonymous"), true);

  assert.deepEqual(
    router.getRequiredProof("proof.policy.authorized-shortcut"),
    ["AUTHORIZED"],
  );
  assert.equal(router.isAuthorized("proof.policy.authorized-shortcut"), true);
  assert.equal(router.isPublic("proof.policy.authorized-shortcut"), false);

  assert.deepEqual(router.getRequiredProof("proof.policy.authorized-proof"), [
    "AUTHORIZED",
  ]);
  assert.equal(router.isAuthorized("proof.policy.authorized-proof"), true);

  assert.deepEqual(router.getRequiredProof("proof.policy.capsule"), [
    "CAPSULE",
  ]);
  assert.equal(router.isPublic("proof.policy.capsule"), false);

  assert.deepEqual(router.getRequiredProof("proof.policy.witness"), [
    "WITNESS",
  ]);
});
