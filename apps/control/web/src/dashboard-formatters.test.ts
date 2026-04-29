import assert from "node:assert/strict";
import test from "node:test";

import { formatDate } from "./dashboard-formatters.js";

test("formatDate tolerates node-runtime date strings that are not ISO timestamps", () => {
  assert.equal(formatDate(undefined, "en"), "-");
  assert.equal(formatDate("n/a", "en"), "-");
  assert.equal(formatDate("8 days ago", "en"), "8 days ago");
  assert.match(formatDate("Wed 2026-03-11 16:12:40 UTC", "en"), /2026/);
});
