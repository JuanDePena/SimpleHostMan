import assert from "node:assert/strict";
import test from "node:test";

import { isExpectedLogTarget } from "./log-health.js";

test("log health distinguishes the active log from stale rotated targets", () => {
  assert.equal(isExpectedLogTarget("/var/log/messages", "/var/log/messages"), true);
  assert.equal(isExpectedLogTarget("/var/log/messages-20260811", "/var/log/messages"), false);
  assert.equal(isExpectedLogTarget("/var/log/messages (deleted)", "/var/log/messages"), false);
});
