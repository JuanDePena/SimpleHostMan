import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { materializeCombinedControlReleaseShadowDeployment } from "./release-shadow-deployment.js";
import {
  activateCombinedControlReleaseShadowVersion,
  readCombinedControlReleaseShadowInventory,
  resolveActiveCombinedControlReleaseShadow,
  type CombinedControlReleaseShadowActivationManifest,
  type CombinedControlReleaseShadowInventory
} from "./release-shadow-activation.js";
import {
  createCombinedControlReleaseShadowLayout,
  type CombinedControlReleaseShadowLayout
} from "./release-shadow-layout.js";
import type { CombinedControlReleaseShadowManifest } from "./release-shadow-manifest.js";

export interface CombinedControlReleaseShadowPromotionManifest {
  readonly kind: "combined-release-shadow-promotion";
  readonly sandboxId: string;
  readonly promotedVersion: string;
  readonly previousPromotedVersion: string | null;
  readonly activeVersion: string;
  readonly promotedAt: string;
  readonly strategy: "workspace-release-shadow";
  readonly emulatedReleaseRoot: "/opt/simplehostman/release";
  readonly shadowReleaseRoot: string;
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly shadowManifestFile: string;
  readonly startupManifestFile: string;
  readonly origin: string;
  readonly surfaces: readonly string[];
  readonly availableVersions: readonly string[];
}

export interface CombinedControlReleaseShadowPromotionRecord {
  readonly promotedVersion: string;
  readonly previousPromotedVersion: string | null;
  readonly promotedAt: string;
  readonly origin: string;
}

export interface CombinedControlReleaseShadowPromotionHistory {
  readonly kind: "combined-release-shadow-promotion-history";
  readonly sandboxId: string;
  readonly records: readonly CombinedControlReleaseShadowPromotionRecord[];
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readShadowStartupManifest(shadowManifest: CombinedControlReleaseShadowManifest) {
  return JSON.parse(
    await readFile(shadowManifest.startupManifestFile, "utf8")
  ) as {
    origin: string;
    surfaces: readonly string[];
  };
}

export async function readCombinedControlReleaseShadowPromotionHistory(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseShadowPromotionHistory> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  const history =
    safeReadJson<CombinedControlReleaseShadowPromotionHistory>(layout.promotionHistoryFile);

  if (history) {
    return history;
  }

  return {
    kind: "combined-release-shadow-promotion-history",
    sandboxId: layout.sandboxId,
    records: []
  };
}

export async function readCombinedControlReleaseShadowPromotionManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseShadowPromotionManifest | null> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  return safeReadJson<CombinedControlReleaseShadowPromotionManifest>(
    layout.promotionManifestFile
  );
}

async function writeCombinedControlReleaseShadowPromotionHistory(args: {
  layout: CombinedControlReleaseShadowLayout;
  history: CombinedControlReleaseShadowPromotionHistory;
}): Promise<void> {
  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.promotionHistoryFile,
    JSON.stringify(args.history, null, 2).concat("\n")
  );
}

export function formatCombinedControlReleaseShadowPromotion(
  manifest: CombinedControlReleaseShadowPromotionManifest
): string {
  return [
    "Combined control release-shadow promotion",
    `Sandbox: ${manifest.sandboxId}`,
    `Promoted version: ${manifest.promotedVersion}`,
    `Previous promoted version: ${manifest.previousPromotedVersion ?? "none"}`,
    `Active version: ${manifest.activeVersion}`,
    `Promoted: ${manifest.promotedAt}`,
    `Strategy: ${manifest.strategy}`,
    `Emulated release root: ${manifest.emulatedReleaseRoot}`,
    `Shadow release root: ${manifest.shadowReleaseRoot}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Origin: ${manifest.origin}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`,
    `Available versions: ${manifest.availableVersions.join(", ") || "none"}`
  ].join("\n");
}

export function formatCombinedControlReleaseShadowPromotionHistory(
  history: CombinedControlReleaseShadowPromotionHistory
): string {
  return [
    "Combined control release-shadow promotion history",
    `Sandbox: ${history.sandboxId}`,
    ...(
      history.records.length > 0
        ? history.records.map(
            (record, index) =>
              `${index + 1}. ${record.promotedAt} :: ${record.promotedVersion} (previous: ${
                record.previousPromotedVersion ?? "none"
              }, origin: ${record.origin})`
          )
        : ["No promotions recorded."]
    )
  ].join("\n");
}

export async function promoteCombinedControlReleaseShadowVersion(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version: string;
}): Promise<{
  layout: CombinedControlReleaseShadowLayout;
  activation: CombinedControlReleaseShadowActivationManifest;
  inventory: CombinedControlReleaseShadowInventory;
  manifest: CombinedControlReleaseShadowManifest;
  promotion: CombinedControlReleaseShadowPromotionManifest;
  history: CombinedControlReleaseShadowPromotionHistory;
}> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  const previousPromotion =
    safeReadJson<CombinedControlReleaseShadowPromotionManifest>(
      layout.promotionManifestFile
    );
  const activation = await activateCombinedControlReleaseShadowVersion(args);
  const active = await resolveActiveCombinedControlReleaseShadow({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const inventory = await readCombinedControlReleaseShadowInventory({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const startup = await readShadowStartupManifest(active.manifest);
  const promotion: CombinedControlReleaseShadowPromotionManifest = {
    kind: "combined-release-shadow-promotion",
    sandboxId: layout.sandboxId,
    promotedVersion: args.version,
    previousPromotedVersion: previousPromotion?.promotedVersion ?? null,
    activeVersion: activation.activeVersion,
    promotedAt: new Date().toISOString(),
    strategy: "workspace-release-shadow",
    emulatedReleaseRoot: "/opt/simplehostman/release",
    shadowReleaseRoot: active.layout.releaseRoot,
    currentRoot: active.layout.currentRoot,
    currentEntrypoint: activation.currentEntrypoint,
    shadowManifestFile: active.layout.shadowManifestFile,
    startupManifestFile: active.layout.startupManifestFile,
    origin: startup.origin,
    surfaces: startup.surfaces,
    availableVersions: inventory.releases.map((release) => release.version)
  };
  const history = await readCombinedControlReleaseShadowPromotionHistory({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const nextHistory: CombinedControlReleaseShadowPromotionHistory = {
    kind: "combined-release-shadow-promotion-history",
    sandboxId: layout.sandboxId,
    records: [
      ...history.records,
      {
        promotedVersion: promotion.promotedVersion,
        previousPromotedVersion: promotion.previousPromotedVersion,
        promotedAt: promotion.promotedAt,
        origin: promotion.origin
      }
    ]
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.promotionManifestFile,
    JSON.stringify(promotion, null, 2).concat("\n")
  );
  await writeFile(
    layout.promotionSummaryFile,
    formatCombinedControlReleaseShadowPromotion(promotion).concat("\n")
  );
  await writeCombinedControlReleaseShadowPromotionHistory({
    layout,
    history: nextHistory
  });
  await materializeCombinedControlReleaseShadowDeployment({
    layout,
    promotion,
    history: nextHistory
  });

  return {
    layout,
    activation,
    inventory,
    manifest: active.manifest,
    promotion,
    history: nextHistory
  };
}
