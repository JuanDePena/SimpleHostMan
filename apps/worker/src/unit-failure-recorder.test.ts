import assert from "node:assert/strict";
import test from "node:test";

import { validateFailureUnit } from "./unit-failure-recorder.js";

test("failure recorder accepts systemd units and rejects shell fragments", () => {
  assert.equal(validateFailureUnit("simplehost-backup-runner.service"), "simplehost-backup-runner.service");
  assert.equal(validateFailureUnit("postgresql@apps.service"), "postgresql@apps.service");
  assert.throws(() => validateFailureUnit("unit.service; reboot"), /invalid systemd unit/i);
});
