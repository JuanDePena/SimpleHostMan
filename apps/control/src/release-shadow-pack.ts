import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";

import {
  type CombinedControlReleaseShadowActivationManifest,
  type CombinedControlReleaseShadowInventory,
  writeCombinedControlReleaseShadowInventory
} from "./release-shadow-activation.js";
import {
  type CombinedControlReleaseShadowDeployManifest,
  type CombinedControlReleaseShadowRollbackManifest,
  readCombinedControlReleaseShadowDeployManifest,
  readCombinedControlReleaseShadowRollbackManifest
} from "./release-shadow-deployment.js";
import { createCombinedControlReleaseShadowLayout } from "./release-shadow-layout.js";
import {
  createCombinedControlReleaseShadowManifest,
  formatCombinedControlReleaseShadowManifest,
  type CombinedControlReleaseShadowManifest
} from "./release-shadow-manifest.js";
import {
  materializeCombinedControlReleaseShadowHandoff,
  type CombinedControlReleaseShadowHandoffManifest
} from "./release-shadow-handoff.js";
import type { CombinedControlReleaseSandboxBundle } from "./release-sandbox-bundle.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";
import {
  type CombinedControlReleaseShadowPromotionHistory,
  type CombinedControlReleaseShadowPromotionManifest,
  promoteCombinedControlReleaseShadowVersion
} from "./release-shadow-promotion.js";
import {
  readCombinedControlReleaseSandboxInventory,
  resolveActiveCombinedControlReleaseSandbox
} from "./release-sandbox-activation.js";
import { createCombinedControlReleaseSandboxLayout } from "./release-sandbox-layout.js";
import { promoteCombinedControlReleaseSandboxVersion } from "./release-sandbox-promotion.js";
import { resolveCombinedControlReleaseSandboxPort } from "./release-sandbox-runner.js";

export interface PackCombinedControlReleaseShadowResult {
  readonly layout: ReturnType<typeof createCombinedControlReleaseShadowLayout>;
  readonly manifest: CombinedControlReleaseShadowManifest;
  readonly handoffManifest: CombinedControlReleaseShadowHandoffManifest;
  readonly inventory: CombinedControlReleaseShadowInventory;
  readonly activation: CombinedControlReleaseShadowActivationManifest;
  readonly promotion: CombinedControlReleaseShadowPromotionManifest;
  readonly history: CombinedControlReleaseShadowPromotionHistory;
  readonly deployManifest: CombinedControlReleaseShadowDeployManifest;
  readonly rollbackManifest: CombinedControlReleaseShadowRollbackManifest;
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
  const sourceInventory = await readCombinedControlReleaseSandboxInventory({
    workspaceRoot: packedSandbox.layout.workspaceRoot,
    sandboxId: packedSandbox.layout.sandboxId
  });

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

  const availableVersions = sourceInventory.releases.map((release) => release.version);
  let activeShadowManifest: CombinedControlReleaseShadowManifest | null = null;

  for (const release of sourceInventory.releases) {
    const sourceReleaseLayout = createCombinedControlReleaseSandboxLayout({
      workspaceRoot: packedSandbox.layout.workspaceRoot,
      sandboxId: packedSandbox.layout.sandboxId,
      version: release.version
    });
    const shadowReleaseLayout = createCombinedControlReleaseShadowLayout({
      workspaceRoot: packedSandbox.layout.workspaceRoot,
      sandboxId: packedSandbox.layout.sandboxId,
      version: release.version
    });

    await removePathIfExists(shadowReleaseLayout.releaseVersionRoot);
    await cp(sourceReleaseLayout.releaseVersionRoot, shadowReleaseLayout.releaseVersionRoot, {
      recursive: true
    });

    const sourceBundle = JSON.parse(
      await readFile(sourceReleaseLayout.bundleManifestFile, "utf8")
    ) as CombinedControlReleaseSandboxBundle;
    const releaseShadowManifest = createCombinedControlReleaseShadowManifest({
      layout: shadowReleaseLayout,
      sandboxBundle: sourceBundle,
      sourceSandboxRoot: packedSandbox.layout.sandboxRoot,
      sourceReleaseVersionRoot: sourceReleaseLayout.releaseVersionRoot,
      sourcePromotionManifestFile: sourceReleaseLayout.promotionManifestFile,
      sourceDeployManifestFile: sourceReleaseLayout.deployManifestFile,
      sourceRollbackManifestFile: sourceReleaseLayout.rollbackManifestFile,
      availableVersions
    });
    await writeFile(
      shadowReleaseLayout.shadowManifestFile,
      JSON.stringify(releaseShadowManifest, null, 2).concat("\n")
    );
    await writeFile(
      shadowReleaseLayout.shadowSummaryFile,
      formatCombinedControlReleaseShadowManifest(releaseShadowManifest).concat("\n")
    );

    if (release.version === active.activation.activeVersion) {
      activeShadowManifest = releaseShadowManifest;
    }
  }

  await removePathIfExists(layout.currentRoot);
  await symlink(layout.releaseVersionRoot, layout.currentRoot);
  const inventory: CombinedControlReleaseShadowInventory = {
    kind: "combined-release-shadow-inventory",
    sandboxId: layout.sandboxId,
    workspaceRoot: layout.workspaceRoot,
    releases: sourceInventory.releases.map((release) => {
      const shadowReleaseLayout = createCombinedControlReleaseShadowLayout({
        workspaceRoot: layout.workspaceRoot,
        sandboxId: layout.sandboxId,
        version: release.version
      });
      return {
        version: release.version,
        releaseVersionRoot: shadowReleaseLayout.releaseVersionRoot,
        envFile: shadowReleaseLayout.envFile,
        startupManifestFile: shadowReleaseLayout.startupManifestFile,
        startupSummaryFile: shadowReleaseLayout.startupSummaryFile,
        shadowManifestFile: shadowReleaseLayout.shadowManifestFile,
        packedAt: release.packedAt,
        sourceCommitish: release.sourceCommitish
      };
    })
  };
  await writeCombinedControlReleaseShadowInventory({
    layout,
    inventory
  });
  const shadowPromotion = await promoteCombinedControlReleaseShadowVersion({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId,
    version: active.activation.activeVersion
  });
  const deployManifest = await readCombinedControlReleaseShadowDeployManifest({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const rollbackManifest = await readCombinedControlReleaseShadowRollbackManifest({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });

  if (!deployManifest || !rollbackManifest) {
    throw new Error("Release-shadow deployment state is incomplete");
  }

  const manifest = activeShadowManifest ?? createCombinedControlReleaseShadowManifest({
    layout,
    sandboxBundle: active.bundle,
    sourceSandboxRoot: active.layout.sandboxRoot,
    sourceReleaseVersionRoot: active.layout.releaseVersionRoot,
    sourcePromotionManifestFile: active.layout.promotionManifestFile,
    sourceDeployManifestFile: active.layout.deployManifestFile,
    sourceRollbackManifestFile: active.layout.rollbackManifestFile,
    availableVersions
  });
  const handoffManifest = await materializeCombinedControlReleaseShadowHandoff({
    layout,
    manifest,
    promotion: shadowPromotion.promotion,
    deployManifest,
    rollbackManifest
  });

  return {
    layout,
    manifest,
    handoffManifest,
    inventory,
    activation: shadowPromotion.activation,
    promotion: shadowPromotion.promotion,
    history: shadowPromotion.history,
    deployManifest,
    rollbackManifest
  };
}
