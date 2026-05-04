const test = require("node:test");
const assert = require("node:assert/strict");

const { LawArticlePresenceSensor } = require("../dist");

test("LawArticlePresenceSensor flags missing law articles in audit mode", async () => {
  const sensor = new LawArticlePresenceSensor({
    getLawArticleCount: () => 0,
  });

  assert.equal(sensor.supports({ intent: "projects.statistics" }), true);

  const decision = await sensor.run({ intent: "projects.statistics" });
  assert.equal(decision.action, "FLAG");
  assert.equal(decision.scoreDelta, 5);
  assert.deepEqual(decision.reasons.slice(0, 1), ["LAW_ARTICLE_MISSING"]);
});

test("LawArticlePresenceSensor denies missing law articles in strict mode", async () => {
  const sensor = new LawArticlePresenceSensor({
    mode: "strict",
    getLawArticleCount: () => 0,
  });

  const decision = await sensor.run({ intent: "projects.statistics" });
  assert.equal(decision.action, "DENY");
  assert.equal(decision.code, "CAPSULE_NOT_LAWFUL");
});

test("LawArticlePresenceSensor allows mapped law articles and skips exemptions", async () => {
  const sensor = new LawArticlePresenceSensor({
    mode: () => "audit",
    exemptIntents: ["system.ping"],
    getLawArticleCount: () => 2,
  });

  assert.equal(sensor.supports({ intent: "system.ping" }), false);
  assert.equal(sensor.supports({ intent: "projects.statistics" }), true);

  const decision = await sensor.run({ intent: "projects.statistics" });
  assert.equal(decision.action, "ALLOW");
  assert.deepEqual(decision.meta, { lawArticles: 2 });
});
