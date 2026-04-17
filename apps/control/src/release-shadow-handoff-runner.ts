import { existsSync } from "node:fs";

import { readCombinedControlReleaseShadowHandoffManifest } from "./release-shadow-handoff.js";
import { startCombinedControlReleaseShadow } from "./release-shadow-runner.js";

export interface CombinedControlReleaseShadowHandoffCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseShadowHandoffResult {
  readonly kind: "combined-release-shadow-handoff";
  readonly sandboxId: string;
  readonly version: string;
  readonly origin: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseShadowHandoffCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseShadowHandoffCheck;
}

export function formatCombinedControlReleaseShadowHandoffResult(
  result: CombinedControlReleaseShadowHandoffResult
): string {
  const passed = result.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-shadow handoff",
    `Sandbox: ${result.sandboxId}`,
    `Version: ${result.version}`,
    `Origin: ${result.origin}`,
    `Status: ${result.status} (${passed}/${result.checks.length})`,
    "",
    ...result.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseShadowHandoff(args: {
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseShadowHandoffResult> {
  const runtime = await startCombinedControlReleaseShadow(args);

  try {
    const handoffManifest = await readCombinedControlReleaseShadowHandoffManifest({
      workspaceRoot: runtime.packed.layout.workspaceRoot,
      sandboxId: runtime.packed.layout.sandboxId
    });
    const health = await fetch(new URL("/healthz", runtime.origin));
    const login = await fetch(new URL("/auth/login", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      body: "email=admin%40example.com&password=good-pass",
      redirect: "manual"
    });

    const checks: CombinedControlReleaseShadowHandoffCheck[] = [
      createCheck(
        "handoff-manifest",
        handoffManifest !== null,
        handoffManifest ? `handoff targets ${handoffManifest.targetReleaseRoot}` : "handoff manifest missing"
      ),
      createCheck(
        "target-root-contract",
        handoffManifest?.targetReleaseRoot === "/opt/simplehostman/release" &&
          handoffManifest?.targetCurrentRoot === "/opt/simplehostman/release/current" &&
          handoffManifest?.targetReleaseVersionRoot ===
            `/opt/simplehostman/release/releases/${runtime.packed.layout.version}`,
        handoffManifest
          ? `${handoffManifest.targetReleaseRoot} -> ${handoffManifest.targetReleaseVersionRoot}`
          : "target release contract unavailable"
      ),
      createCheck(
        "source-artifacts-present",
        handoffManifest !== null &&
          [
            handoffManifest.sourceReleaseVersionRoot,
            handoffManifest.sourcePromotionManifestFile,
            handoffManifest.sourceDeployManifestFile,
            handoffManifest.sourceRollbackManifestFile,
            handoffManifest.startupManifestFile,
            handoffManifest.envFile
          ].every((path) => existsSync(path)),
        handoffManifest
          ? "source artifacts for handoff are present in the release-shadow"
          : "source artifact check skipped"
      ),
      createCheck(
        "promotion-alignment",
        handoffManifest?.promotedVersion === runtime.packed.promotion.promotedVersion &&
          handoffManifest.previousVersion === runtime.packed.promotion.previousPromotedVersion,
        handoffManifest
          ? `promoted=${handoffManifest.promotedVersion} previous=${handoffManifest.previousVersion ?? "none"}`
          : "handoff promotion state unavailable"
      ),
      createCheck(
        "surface-alignment",
        JSON.stringify(handoffManifest?.surfaces ?? []) ===
          JSON.stringify(runtime.shadowManifest.surfaces),
        handoffManifest
          ? handoffManifest.surfaces.join(", ")
          : "handoff surface list unavailable"
      ),
      createCheck(
        "planned-steps",
        (handoffManifest?.steps.length ?? 0) >= 10 &&
          (handoffManifest?.steps.some(
            (step) => step.kind === "copy-tree" && step.target === handoffManifest.targetReleaseVersionRoot
          ) ??
            false) &&
          (handoffManifest?.steps.some(
            (step) => step.kind === "write-symlink" && step.target === handoffManifest.targetCurrentRoot
          ) ??
            false),
        handoffManifest
          ? `${handoffManifest.steps.length} planned steps`
          : "handoff steps unavailable"
      ),
      createCheck(
        "runtime-healthz",
        health.status === 200,
        `healthz returned ${health.status}`
      ),
      createCheck(
        "runtime-login",
        login.status === 303,
        `login returned ${login.status}`
      )
    ];

    return {
      kind: "combined-release-shadow-handoff",
      sandboxId: runtime.packed.layout.sandboxId,
      version: runtime.packed.layout.version,
      origin: runtime.origin,
      status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
      checks
    };
  } finally {
    await runtime.close();
  }
}
