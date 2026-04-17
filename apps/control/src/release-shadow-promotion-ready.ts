import {
  readCombinedControlReleaseShadowDeployManifest,
  readCombinedControlReleaseShadowRollbackManifest
} from "./release-shadow-deployment.js";
import { readCombinedControlReleaseShadowPromotionManifest } from "./release-shadow-promotion.js";
import { packCombinedControlReleaseShadow } from "./release-shadow-pack.js";
import { startCombinedControlReleaseShadow } from "./release-shadow-runner.js";

export interface CombinedControlReleaseShadowPromotionReadyCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseShadowPromotionReadyResult {
  readonly kind: "combined-release-shadow-promotion-ready";
  readonly sandboxId: string;
  readonly version: string;
  readonly origin: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseShadowPromotionReadyCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseShadowPromotionReadyCheck;
}

export function formatCombinedControlReleaseShadowPromotionReady(
  result: CombinedControlReleaseShadowPromotionReadyResult
): string {
  const passed = result.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-shadow promotion-ready",
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

export async function runCombinedControlReleaseShadowPromotionReady(args: {
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseShadowPromotionReadyResult> {
  const packed = await packCombinedControlReleaseShadow({
    sandboxId: args.sandboxId,
    version: args.version,
    host: args.host,
    port: args.port,
    clean: false
  });
  const runtime = await startCombinedControlReleaseShadow({
    workspaceRoot: packed.layout.workspaceRoot,
    sandboxId: packed.layout.sandboxId,
    version: packed.layout.version,
    host: args.host,
    port: args.port
  });

  try {
    const promotionManifest = await readCombinedControlReleaseShadowPromotionManifest({
      workspaceRoot: packed.layout.workspaceRoot,
      sandboxId: packed.layout.sandboxId
    });
    const deployManifest = await readCombinedControlReleaseShadowDeployManifest({
      workspaceRoot: packed.layout.workspaceRoot,
      sandboxId: packed.layout.sandboxId
    });
    const rollbackManifest = await readCombinedControlReleaseShadowRollbackManifest({
      workspaceRoot: packed.layout.workspaceRoot,
      sandboxId: packed.layout.sandboxId
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
    const checks: CombinedControlReleaseShadowPromotionReadyCheck[] = [
      createCheck(
        "promotion-manifest",
        promotionManifest?.promotedVersion === packed.promotion.promotedVersion,
        promotionManifest
          ? `promotion manifest targets ${promotionManifest.promotedVersion}`
          : "promotion manifest missing"
      ),
      createCheck(
        "deploy-manifest",
        deployManifest?.promotedVersion === packed.promotion.promotedVersion,
        deployManifest
          ? `deploy manifest targets ${deployManifest.promotedVersion}`
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
        "current-symlink",
        runtime.packed.activation.activeVersion === packed.promotion.promotedVersion,
        `current points to ${runtime.packed.activation.activeVersion}`
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
      kind: "combined-release-shadow-promotion-ready",
      sandboxId: packed.layout.sandboxId,
      version: packed.layout.version,
      origin: runtime.origin,
      status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
      checks
    };
  } finally {
    await runtime.close();
  }
}
