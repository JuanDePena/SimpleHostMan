import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePgBackRestStanza } from "./pgbackrest-health.js";

const nowMs = Date.parse("2026-08-19T12:00:00Z");

test("pgBackRest health accepts a fresh full and empty archive queue", () => {
  const observation = evaluatePgBackRestStanza({
    stanza: "apps",
    info: {
      status: { code: 0, message: "ok" },
      backup: [
        {
          type: "full",
          label: "20260819-100000F",
          timestamp: { stop: Date.parse("2026-08-19T10:00:00Z") / 1_000 }
        }
      ]
    },
    archiveReadyCount: 0,
    nowMs,
    maxFullAgeHours: 192,
    warningReadyCount: 64,
    criticalReadyCount: 256
  });

  assert.equal(observation.state, "ok");
  assert.equal(observation.latestFullLabel, "20260819-100000F");
});

test("pgBackRest health fails closed for stale full or archive backlog", () => {
  const observation = evaluatePgBackRestStanza({
    stanza: "apps",
    info: {
      status: { code: 0, message: "ok" },
      backup: [
        {
          type: "full",
          label: "old",
          timestamp: { stop: Date.parse("2026-08-01T10:00:00Z") / 1_000 }
        }
      ]
    },
    archiveReadyCount: 300,
    nowMs,
    maxFullAgeHours: 192,
    warningReadyCount: 64,
    criticalReadyCount: 256
  });

  assert.equal(observation.state, "critical");
  assert.match(observation.errors.join(" "), /latest full/i);
  assert.match(observation.errors.join(" "), /archive queue/i);
});
