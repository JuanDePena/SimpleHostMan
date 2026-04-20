import test from "node:test";
import assert from "node:assert/strict";

import { extractReportedInstalledPackages } from "./control-plane-store-auth.js";

test("extractReportedInstalledPackages dedupes repeated packageName+arch entries", () => {
  const packages = extractReportedInstalledPackages({
    packages: [
      {
        packageName: "gpg-pubkey",
        version: "08b40d20",
        release: "6581afc1",
        arch: "(none)",
        nevra: "gpg-pubkey-08b40d20-6581afc1.(none)",
        installedAt: "2026-04-19T13:38:34.000Z"
      },
      {
        packageName: "gpg-pubkey",
        version: "c2a1e572",
        release: "668fe8ef",
        arch: "(none)",
        nevra: "gpg-pubkey-c2a1e572-668fe8ef.(none)",
        installedAt: "2025-05-28T19:35:21.000Z"
      },
      {
        packageName: "code-server",
        version: "4.115.0",
        release: "1",
        arch: "x86_64",
        nevra: "code-server-4.115.0-1.x86_64",
        installedAt: "2026-04-14T02:43:46.000Z"
      }
    ]
  });

  assert.ok(packages);
  assert.equal(packages.length, 2);
  assert.deepEqual(
    packages.map((entry) => `${entry.packageName}|${entry.arch}|${entry.version}`),
    ["gpg-pubkey|(none)|08b40d20", "code-server|x86_64|4.115.0"]
  );
});

test("extractReportedInstalledPackages keeps the latest duplicate when timestamps are missing", () => {
  const packages = extractReportedInstalledPackages({
    packages: [
      {
        packageName: "example",
        version: "1.0.0",
        release: "1",
        arch: "x86_64",
        nevra: "example-1.0.0-1.x86_64"
      },
      {
        packageName: "example",
        version: "1.1.0",
        release: "1",
        arch: "x86_64",
        nevra: "example-1.1.0-1.x86_64"
      }
    ]
  });

  assert.ok(packages);
  assert.equal(packages.length, 1);
  assert.equal(packages[0]?.version, "1.1.0");
});
