import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapAxisErrorCodeToStatus, validateAxisMagic } from "./axis-intake";

describe("axis intake helpers", () => {
  it("validates AXIS frame magic without depending on app sensors", () => {
    const expected = Buffer.from("AXIS1", "ascii");

    assert.deepEqual(validateAxisMagic(Buffer.from("AXIS1"), expected), {
      valid: true,
      actual: undefined,
    });

    assert.deepEqual(validateAxisMagic(Buffer.from("NOPE1"), expected), {
      valid: false,
      actual: "NOPE1",
    });
  });

  it("maps common sensor error codes to HTTP statuses", () => {
    assert.equal(mapAxisErrorCodeToStatus("PAYLOAD_TOO_LARGE"), 413);
    assert.equal(mapAxisErrorCodeToStatus("COUNTRY_BLOCKED"), 403);
    assert.equal(mapAxisErrorCodeToStatus("RATE_LIMIT"), 429);
    assert.equal(mapAxisErrorCodeToStatus("UNKNOWN"), 400);
  });
});
