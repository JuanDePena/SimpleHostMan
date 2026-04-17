import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";

import {
  readCombinedControlReleaseSandboxDeployManifest,
  readCombinedControlReleaseSandboxRollbackManifest,
  type CombinedControlReleaseSandboxDeployManifest,
  type CombinedControlReleaseSandboxRollbackManifest
} from "./release-sandbox-deployment.js";
import { createCombinedControlReleaseShadowLayout } from "./release-shadow-layout.js";
import {
  createCombinedControlReleaseShadowManifest,
  formatCombinedControlReleaseShadowManifest,
  type CombinedControlReleaseShadowManifest
} from "./release-shadow-manifest.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";
import {
  promoteCombinedControlReleaseSandboxVersion,
  readCombinedControlReleaseSandboxPromotionManifest,
  type CombinedControlReleaseSandboxPromotionManifest
} from "./release-sandbox-promotion.js";
import { resolveActiveCombinedControlReleaseSandbox } from "./release-sandbox-activation.js";
import { resolveCombinedControlReleaseSandboxPort } from "./release-sandbox-runner.js";

export interface PackCombinedControlReleaseShadowResult {
  readonly layout: ReturnType<typeof createCombinedControlReleaseShadowLayout>;
  readonly manifest: CombinedControlReleaseShadowManifest;
  readonly promotion: CombinedControlReleaseSandboxPromotionManifest;
  readonly deployManifest: CombinedControlReleaseSandboxDeployManifest;
  readonly rollbackManifest: CombinedControlReleaseSandboxRollbackManifest;
}

async function removePathIfExists(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const stat = lstatSync(path);
  await rm(path, { recursive: stat.isDirectory(), force: true });
}

export async function packCombinedControlReleaseShadow(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
  clean?: boolean;
} = {}): Promise<PackCombinedControlReleaseShadowResult> {
  const host = args.host ?? "127.0.0.1";
  const port = await resolveCombinedControlReleaseSandboxPort(args.port);
  const packedSandbox = await packCombinedControlReleaseSandbox({
    workspaceRoot: args.workspaceRoot,
    sandboxId: args.sandboxId,
    version: args.version,
    host,
    port,
    clean: false
  });
  await promoteCombinedControlReleaseSandboxVersion({
    workspaceRoot: packedSandbox.layout.workspaceRoot,
    sandboxId: packedSandbox.layout.sandboxId,
    version: packedSandbox.layout.version
  });
  const active = await resolveActiveCombinedControlReleaseSandbox({
    workspaceRoot: packedSandbox.layout.workspaceRoot,
    sandboxId: packedSandbox.layout.sandboxId
  });
  const promotion =
    await readCombinedControlReleaseSandboxPromotionManifest({
      workspaceRoot: packedSandbox.layout.workspaceRoot,
      sandboxId: packedSandbox.layout.sandboxId
    });
  const deployManifest =
    await readCombinedControlReleaseSandboxDeployManifest({
      workspaceRoot: packedSandbox.layout.workspaceRoot,
      sandboxId: packedSandbox.layout.sandboxId
    });
  const rollbackManifest =
    await readCombinedControlReleaseSandboxRollbackManifest({
      workspaceRoot: packedSandbox.layout.workspaceRoot,
      sandboxId: packedSandbox.layout.sandboxId
    });

  if (!promotion || !deployManifest || !rollbackManifest) {
    throw new Error("Sandbox promotion state is incomplete; deploy/rollback manifests missing");
  }

  const layout = createCombinedControlReleaseShadowLayout({
    workspaceRoot: packedSandbox.layout.workspaceRoot,
    sandboxId: packedSandbox.layout.sandboxId,
    version: active.activation.activeVersion
  });

  if (args.clean !== false) {
    await rm(layout.shadowRoot, { recursive: true, force: true });
  }

  await mkdir(layout.releasesRoot, { recursive: true });
  await mkdir(layout.sharedMetaDir, { recursive: true });
  await mkdir(layout.sharedTmpDir, { recursive: true });
  await mkdir(layout.sharedLogsDir, { recursive: true });
  await mkdir(layout.sharedRunDir, { recursive: true });
  await mkdir(layout.logsDir, { recursive: true });
  await mkdir(layout.runDir, { recursive: true });

  await removePathIfExists(layout.releaseVersionRoot);
  await cp(active.layout.releaseVersionRoot, layout.releaseVersionRoot, {
    recursive: true
  });

  await removePathIfExists(layout.currentRoot);
  await symlink(layout.releaseVersionRoot, layout.currentRoot);

  await cp(active.layout.sharedMetaDir, layout.sharedMetaDir, { recursive: true });

  const manifest = createCombinedControlReleaseShadowManifest({
    layout,
    sandboxBundle: active.bundle,
    promotionManifest: promotion,
    deployManifest,
    rollbackManifest,
    sourceSandboxRoot: active.layout.sandboxRoot,
    sourceReleaseVersionRoot: active.layout.releaseVersionRoot,
    sourcePromotionManifestFile: active.layout.promotionManifestFile,
    sourceDeployManifestFile: active.layout.deployManifestFile,
    sourceRollbackManifestFile: active.layout.rollbackManifestFile
  });

  await writeFile(
    layout.shadowManifestFile,
    JSON.stringify(manifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.shadowSummaryFile,
    formatCombinedControlReleaseShadowManifest(manifest).concat("\n")
  );

  return {
    layout,
    manifest,
    promotion,
    deployManifest,
    rollbackManifest
  };
}
