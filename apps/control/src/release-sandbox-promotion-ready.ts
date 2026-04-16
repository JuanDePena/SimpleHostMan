import {
  readCombinedControlReleaseSandboxDeployManifest,
  readCombinedControlReleaseSandboxRollbackManifest
} from "./release-sandbox-deployment.js";
import { readCombinedControlReleaseSandboxPromotionManifest } from "./release-sandbox-promotion.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";
import {
  resolveCombinedControlReleaseSandboxPort,
  startExistingCombinedControlReleaseSandbox
} from "./release-sandbox-runner.js";
import { promoteCombinedControlReleaseSandboxVersion } from "./release-sandbox-promotion.js";

export interface CombinedControlReleaseSandboxPromotionReadyCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseSandboxPromotionReadyResult {
  readonly kind: "combined-release-sandbox-promotion-ready";
  readonly sandboxId: string;
  readonly version: string;
  readonly origin: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseSandboxPromotionReadyCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseSandboxPromotionReadyCheck;
}

export function formatCombinedControlReleaseSandboxPromotionReady(
  result: CombinedControlReleaseSandboxPromotionReadyResult
): string {
  const passed = result.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-sandbox promotion-ready",
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

export async function runCombinedControlReleaseSandboxPromotionReady(args: {
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseSandboxPromotionReadyResult> {
  const host = args.host ?? "127.0.0.1";
  const port = await resolveCombinedControlReleaseSandboxPort(args.port);
  const packed = await packCombinedControlReleaseSandbox({
    sandboxId: args.sandboxId,
    version: args.version,
    host,
    port,
    clean: false
  });
  const promoted = await promoteCombinedControlReleaseSandboxVersion({
    workspaceRoot: packed.layout.workspaceRoot,
    sandboxId: packed.layout.sandboxId,
    version: packed.layout.version
  });
  const runtime = await startExistingCombinedControlReleaseSandbox({
    workspaceRoot: packed.layout.workspaceRoot,
    sandboxId: packed.layout.sandboxId,
    host,
    port
  });

  try {
    const deployManifest = await readCombinedControlReleaseSandboxDeployManifest({
      workspaceRoot: packed.layout.workspaceRoot,
      sandboxId: packed.layout.sandboxId
    });
    const rollbackManifest = await readCombinedControlReleaseSandboxRollbackManifest({
      workspaceRoot: packed.layout.workspaceRoot,
      sandboxId: packed.layout.sandboxId
    });
    const promotionManifest = await readCombinedControlReleaseSandboxPromotionManifest({
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
    const checks: CombinedControlReleaseSandboxPromotionReadyCheck[] = [
      createCheck(
        "promotion-manifest",
        promotionManifest?.promotedVersion === promoted.promotion.promotedVersion,
        promotionManifest
          ? `promotion manifest targets ${promotionManifest.promotedVersion}`
          : "promotion manifest missing"
      ),
      createCheck(
        "deploy-manifest",
        deployManifest?.promotedVersion === promoted.promotion.promotedVersion,
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
        "runtime-healthz",
        health.status === 200,
        `healthz returned ${health.status}`
      ),
      createCheck(
        "runtime-login",
        login.status === 303,
        `login returned ${login.status}`
      ),
      createCheck(
        "active-version",
        runtime.activation.activeVersion === promoted.promotion.promotedVersion,
        `runtime active version is ${runtime.activation.activeVersion}`
      )
    ];

    return {
      kind: "combined-release-sandbox-promotion-ready",
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
