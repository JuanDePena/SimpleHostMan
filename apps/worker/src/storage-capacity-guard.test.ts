import assert from "node:assert/strict";
import test from "node:test";

import { classifyCapacity, loadCapacityThresholds } from "./storage-capacity-guard.js";

const thresholds = {
  warningPercent: 70,
  criticalPercent: 85,
  warningFreeBytes: 10 * 1024 ** 3,
  criticalFreeBytes: 5 * 1024 ** 3
};

test("capacity is critical when either hard limit is reached", () => {
  assert.equal(classifyCapacity(85, 100 * 1024 ** 3, thresholds).state, "critical");
  assert.equal(classifyCapacity(10, 5 * 1024 ** 3, thresholds).state, "critical");
});

test("capacity warns before the hard limit", () => {
  assert.equal(classifyCapacity(70, 100 * 1024 ** 3, thresholds).state, "warning");
  assert.equal(classifyCapacity(10, 10 * 1024 ** 3, thresholds).state, "warning");
  assert.equal(classifyCapacity(50, 50 * 1024 ** 3, thresholds).state, "ok");
});

test("capacity threshold configuration is ordered", () => {
  assert.throws(
    () => loadCapacityThresholds({ SIMPLEHOST_CAPACITY_WARNING_PERCENT: "90" }),
    /warning percent must be lower/i
  );
  assert.throws(
    () => loadCapacityThresholds({ SIMPLEHOST_CAPACITY_WARNING_FREE_GIB: "4" }),
    /warning free-space threshold must exceed/i
  );
});
