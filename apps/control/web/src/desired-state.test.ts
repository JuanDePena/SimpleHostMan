import assert from "node:assert/strict";
import test from "node:test";

import { parseMailPolicyForm } from "./desired-state.js";

test("parseMailPolicyForm parses anti-spam thresholds, sender lists, and rate limits", () => {
  const form = new URLSearchParams({
    rejectThreshold: "14",
    addHeaderThreshold: "5",
    greylistThreshold: "3",
    senderAllowlist: "Ops@Example.com\n@example.net",
    senderDenylist: "Block@Example.com, @spam.test",
    rateLimitBurst: "30",
    rateLimitPeriodSeconds: "60"
  });

  assert.deepEqual(parseMailPolicyForm(form), {
    rejectThreshold: 14,
    addHeaderThreshold: 5,
    greylistThreshold: 3,
    senderAllowlist: ["ops@example.com", "@example.net"],
    senderDenylist: ["block@example.com", "@spam.test"],
    rateLimit: {
      burst: 30,
      periodSeconds: 60
    }
  });
});

test("parseMailPolicyForm rejects greylist thresholds at or above add-header", () => {
  const form = new URLSearchParams({
    rejectThreshold: "12",
    addHeaderThreshold: "5",
    greylistThreshold: "5"
  });

  assert.throws(
    () => parseMailPolicyForm(form),
    /Greylist threshold must be below add-header threshold/i
  );
});
