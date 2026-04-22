require("reflect-metadata");

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PriorityOrder,
  getPriorityOrder,
  getPriorityOrderedTargets,
} = require("../dist");

class LowLateMiddleware {}
class HighLateMiddleware {}
class HighEarlyMiddleware {}

PriorityOrder("LOW", 20)(LowLateMiddleware);
PriorityOrder("HIGH", 10)(HighLateMiddleware);
PriorityOrder({ priority: "high", order: 0 })(HighEarlyMiddleware);

test("@PriorityOrder stores normalized metadata", () => {
  assert.deepEqual(getPriorityOrder(HighEarlyMiddleware), {
    priority: "HIGH",
    order: 0,
  });
});

test("getPriorityOrderedTargets sorts by priority then order", () => {
  const ordered = getPriorityOrderedTargets([
    LowLateMiddleware,
    HighLateMiddleware,
    HighEarlyMiddleware,
  ]);

  assert.deepEqual(ordered, [
    HighEarlyMiddleware,
    HighLateMiddleware,
    LowLateMiddleware,
  ]);
});

test("@PriorityOrder rejects invalid order values", () => {
  assert.throws(() => PriorityOrder("MEDIUM", -1), /non-negative integer/);
});
