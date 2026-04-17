import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  createCombinedControlReleaseTargetLayout,
  type CombinedControlReleaseTargetLayout
} from "./release-target-layout.js";
import {
  readCombinedControlReleaseShadowHandoffManifest,
  type CombinedControlReleaseShadowHandoffManifest,
  type CombinedControlReleaseShadowHandoffStep
} from "./release-shadow-handoff.js";
import { packCombinedControlReleaseShadow } from "./release-shadow-pack.js";

export interface CombinedControlReleaseTargetApplyRecord {
  readonly kind: CombinedControlReleaseShadowHandoffStep["kind"];
  readonly source?: string;
  readonly target: string;
  readonly detail: string;
}

export interface CombinedControlReleaseTargetApplyManifest {
  readonly kind: "combined-release-target-apply";
  readonly sandboxId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-target-apply";
  readonly sourceHandoffManifestFile: string;
  readonly targetReleaseRoot: string;
  readonly targetCurrentRoot: string;
  readonly targetReleaseVersionRoot: string;
  readonly records: readonly CombinedControlReleaseTargetApplyRecord[];
}

function mapTargetPath(
  handoffManifest: CombinedControlReleaseShadowHandoffManifest,
  layout: CombinedControlReleaseTargetLayout,
  target: string
): string {
  if (!target.startsWith(handoffManifest.targetReleaseRoot)) {
    throw new Error(`Unsupported handoff target outside release root: ${target}`);
  }
  return target.replace(handoffManifest.targetReleaseRoot, layout.releaseRoot);
}

function mapSourcePath(
  handoffManifest: CombinedControlReleaseShadowHandoffManifest,
  sourceReleaseRoot: string,
  source: string
): string {
  if (!source.startsWith(handoffManifest.targetReleaseRoot)) {
    return source;
  }
  return source.replace(handoffManifest.targetReleaseRoot, sourceReleaseRoot);
}

async function removePathIfExists(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const stat = lstatSync(path);
  await rm(path, { recursive: stat.isDirectory(), force: true });
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export async function readCombinedControlReleaseTargetApplyManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseTargetApplyManifest | null> {
  const layout = createCombinedControlReleaseTargetLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseTargetApplyManifest>(layout.applyManifestFile);
  } catch {
    return null;
  }
}

export function formatCombinedControlReleaseTargetApplyManifest(
  manifest: CombinedControlReleaseTargetApplyManifest
): string {
  return [
    "Combined control release-target apply manifest",
    `Sandbox: ${manifest.sandboxId}`,
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
    `Target release version root: ${manifest.targetReleaseVersionRoot}`,
    `Target current root: ${manifest.targetCurrentRoot}`,
    "",
    "Applied records:",
    ...manifest.records.map((record, index) =>
      `${index + 1}. ${record.kind} ${record.target}${record.source ? ` <= ${record.source}` : ""} :: ${record.detail}`
    )
  ].join("\n");
}

export async function applyCombinedControlReleaseTarget(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
  clean?: boolean;
} = {}): Promise<{
  layout: CombinedControlReleaseTargetLayout;
  handoffManifest: CombinedControlReleaseShadowHandoffManifest;
  applyManifest: CombinedControlReleaseTargetApplyManifest;
}> {
  const packedShadow = await packCombinedControlReleaseShadow({
    workspaceRoot: args.workspaceRoot,
    sandboxId: args.sandboxId,
    version: args.version,
    host: args.host,
    port: args.port,
    clean: false
  });
  const handoffManifest =
    (await readCombinedControlReleaseShadowHandoffManifest({
      workspaceRoot: packedShadow.layout.workspaceRoot,
      sandboxId: packedShadow.layout.sandboxId
    })) ??
    (() => {
      throw new Error("Release-shadow handoff manifest missing");
    })();

  const layout = createCombinedControlReleaseTargetLayout({
    workspaceRoot: packedShadow.layout.workspaceRoot,
    sandboxId: packedShadow.layout.sandboxId,
    version: packedShadow.layout.version
  });

  if (args.clean !== false) {
    await rm(layout.targetRoot, { recursive: true, force: true });
  }

  const records: CombinedControlReleaseTargetApplyRecord[] = [];
  for (const step of handoffManifest.steps) {
    const target = mapTargetPath(handoffManifest, layout, step.target);
    const source = step.source
      ? mapSourcePath(handoffManifest, packedShadow.layout.releaseRoot, step.source)
      : undefined;

    switch (step.kind) {
      case "ensure-dir":
        await mkdir(target, { recursive: true });
        break;
      case "copy-tree":
        if (!source) {
          throw new Error(`copy-tree step missing source for ${target}`);
        }
        await removePathIfExists(target);
        await mkdir(dirname(target), { recursive: true });
        await cp(source, target, { recursive: true });
        break;
      case "copy-file":
        if (!source) {
          throw new Error(`copy-file step missing source for ${target}`);
        }
        await mkdir(dirname(target), { recursive: true });
        await cp(source, target);
        break;
      case "write-symlink":
        if (!step.source) {
          throw new Error(`write-symlink step missing source for ${target}`);
        }
        await removePathIfExists(target);
        await symlink(mapTargetPath(handoffManifest, layout, step.source), target);
        break;
      default:
        throw new Error(`Unsupported handoff step kind: ${(step as { kind: string }).kind}`);
    }

    records.push({
      kind: step.kind,
      source,
      target,
      detail: step.detail
    });
  }

  const applyManifest: CombinedControlReleaseTargetApplyManifest = {
    kind: "combined-release-target-apply",
    sandboxId: layout.sandboxId,
    version: layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-target-apply",
    sourceHandoffManifestFile: packedShadow.layout.handoffManifestFile,
    targetReleaseRoot: layout.releaseRoot,
    targetCurrentRoot: layout.currentRoot,
    targetReleaseVersionRoot: layout.releaseVersionRoot,
    records
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.applyManifestFile,
    JSON.stringify(applyManifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.applySummaryFile,
    formatCombinedControlReleaseTargetApplyManifest(applyManifest).concat("\n")
  );

  return {
    layout,
    handoffManifest,
    applyManifest
  };
}
