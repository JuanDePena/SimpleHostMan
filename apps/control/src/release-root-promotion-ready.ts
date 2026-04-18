import { readFileSync } from "node:fs";

import {
  readCombinedControlReleaseRootPromotionInventory,
  resolveActiveCombinedControlReleaseRootPromotion
} from "./release-root-promotion-activation.js";
import { startCombinedControlReleaseRootPromotion } from "./release-root-promotion-runner.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";

interface PromotionManifestLike {
  readonly promotedVersion?: string;
}

interface RollbackManifestLike {
  readonly rollbackVersion?: string | null;
}

export interface CombinedControlReleaseRootPromotionReadyCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootPromotionReadyResult {
  readonly kind: "combined-release-root-promotion-ready";
  readonly targetId: string;
  readonly version: string;
  readonly origin: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootPromotionReadyCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootPromotionReadyCheck;
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function formatCombinedControlReleaseRootPromotionReady(
  result: CombinedControlReleaseRootPromotionReadyResult
): string {
  const passed = result.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root promotion ready",
    `Target: ${result.targetId}`,
    `Version: ${result.version}`,
    `Origin: ${result.origin}`,
    `Status: ${result.status} (${passed}/${result.checks.length})`,
    "",
    ...result.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootPromotionReady(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseRootPromotionReadyResult> {
  await applyCombinedControlReleaseRootStaging({
    workspaceRoot: args.workspaceRoot,
    sandboxId: args.targetId ? `${args.targetId}-staging` : undefined,
    version: args.version,
    host: args.host,
    port: args.port,
    clean: false
  });
  const runtime = await startCombinedControlReleaseRootPromotion({
    workspaceRoot: args.workspaceRoot,
    targetId: args.targetId,
    version: args.version
  });

  try {
    const inventory = await readCombinedControlReleaseRootPromotionInventory({
      workspaceRoot: runtime.layout.workspaceRoot,
      targetId: runtime.layout.targetId
    });
    const active = await resolveActiveCombinedControlReleaseRootPromotion({
      workspaceRoot: runtime.layout.workspaceRoot,
      targetId: runtime.layout.targetId
    });
    const promotionManifest = safeReadJson<PromotionManifestLike>(
      runtime.layout.promotionManifestFile
    );
    const deployManifest = safeReadJson<PromotionManifestLike>(
      runtime.layout.deployManifestFile
    );
    const rollbackManifest = safeReadJson<RollbackManifestLike>(
      runtime.layout.rollbackManifestFile
    );
    const health = await fetch(new URL("/healthz", runtime.origin));
    const login = await fetch(new URL("/auth/login", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      body: "email=admin%40example.com&password=good-pass",
      redirect: "manual"
    });

    const checks: CombinedControlReleaseRootPromotionReadyCheck[] = [
      createCheck(
        "promotion-manifest",
        promotionManifest?.promotedVersion === runtime.layout.version,
        promotionManifest
          ? `promotion manifest targets ${promotionManifest.promotedVersion ?? "unknown"}`
          : "promotion manifest missing"
      ),
      createCheck(
        "deploy-manifest",
        deployManifest?.promotedVersion === runtime.layout.version,
        deployManifest
          ? `deploy manifest targets ${deployManifest.promotedVersion ?? "unknown"}`
          : "deploy manifest missing"
      ),
      createCheck(
        "rollback-manifest",
        rollbackManifest !== null,
        rollbackManifest
          ? `rollback manifest points to ${rollbackManifest.rollbackVersion ?? "no previous release"}`
          : "rollback manifest missing"
      ),
      createCheck(
        "inventory",
        inventory.releases.some((release) => release.version === runtime.layout.version),
        `inventory contains versions ${inventory.releases.map((release) => release.version).join(", ") || "none"}`
      ),
      createCheck(
        "activation",
        active.activation.activeVersion === runtime.layout.version,
        `active version is ${active.activation.activeVersion}`
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
      kind: "combined-release-root-promotion-ready",
      targetId: runtime.layout.targetId,
      version: runtime.layout.version,
      origin: runtime.origin,
      status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
      checks
    };
  } finally {
    await runtime.close();
  }
}
