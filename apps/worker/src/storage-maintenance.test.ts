import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStorageMaintenanceOptions,
  detectBlockingProcesses,
  parseStorageMaintenanceCliArgs,
  selectReleaseCandidates,
  shouldApplyMaintenance
} from "./storage-maintenance.js";

test("storage maintenance CLI is dry-run by default and requires an explicit apply", () => {
  assert.deepEqual(parseStorageMaintenanceCliArgs([]), {
    mode: "dry-run",
    json: false,
    reportPath: undefined
  });
  assert.deepEqual(parseStorageMaintenanceCliArgs(["--apply", "--json", "--no-report"]), {
    mode: "apply",
    json: true,
    reportPath: ""
  });
});

test("storage maintenance options reject an unsafe watermark order", () => {
  assert.throws(
    () =>
      buildStorageMaintenanceOptions(
        { mode: "dry-run", json: false },
        {
          SIMPLEHOST_STORAGE_HIGH_WATERMARK_PERCENT: "80",
          SIMPLEHOST_STORAGE_TARGET_WATERMARK_PERCENT: "85"
        }
      ),
    /target watermark must be lower/
  );
});

test("release selection protects active, pinned, metadata and latest releases", () => {
  const now = new Date("2026-07-21T12:00:00Z");
  const release = (name: string, ageDays: number, sizeBytes = 10) => ({
    name,
    path: `/opt/simplehostman/release/releases/${name}`,
    mtimeMs: now.getTime() - ageDays * 24 * 60 * 60 * 1000,
    sizeBytes
  });
  const inventory = selectReleaseCandidates(
    [
      release("active", 30),
      release("latest", 1),
      release("pinned", 30),
      release("metadata", 30),
      release("young", 3),
      release("old", 30)
    ],
    {
      activeRelease: "active",
      pinnedReleases: ["pinned"],
      metadataReleases: ["metadata"],
      keep: 1,
      minAgeDays: 7,
      now
    }
  );

  assert.deepEqual(inventory.candidates.map((entry) => entry.name), ["old"]);
  assert.equal(
    inventory.protected.find((entry) => entry.name === "active")?.protectedReasons.includes("active"),
    true
  );
  assert.equal(
    inventory.protected.find((entry) => entry.name === "young")?.protectedReasons.includes("minimum-age"),
    true
  );
});

test("Genesis and deployment processes block apply", () => {
  const blockers = detectBlockingProcesses(
    [
      { pid: 10, command: "bash /root/run-platform-genesis-aal2.sh" },
      { pid: 11, command: "node harmless.js" }
    ],
    ["run-platform-genesis-aal2.sh"],
    99
  );

  assert.deepEqual(blockers, [
    { pid: 10, command: "bash /root/run-platform-genesis-aal2.sh" }
  ]);
  assert.equal(shouldApplyMaintenance("apply", 94, 85, blockers.length), false);
  assert.equal(shouldApplyMaintenance("apply", 94, 85, 0), true);
  assert.equal(shouldApplyMaintenance("dry-run", 94, 85, 0), false);
  assert.equal(shouldApplyMaintenance("apply", 75, 85, 0), false);
});
