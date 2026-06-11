import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  normalizeApacheVhostForParity,
  renderPyrosaIamGatewayApacheVhost,
  type IamApacheApplyResult,
  type IamBindingSummary
} from "@simplehost/control-contracts";

const execFileAsync = promisify(execFile);
const httpdConfDirectory = "/etc/httpd/conf.d";
const rollbackRoot = "/etc/simplehost/rollback";
const spoolRoot = "/var/lib/simplehost/iam-apache";
const applyHelperPath =
  process.env.SIMPLEHOST_IAM_APACHE_APPLY_HELPER ??
  "/opt/simplehostman/release/current/scripts/control/apply-iam-apache-vhost-root.sh";

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "iam-binding";
}

function timestampSegment(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "").replace(/Z$/u, "Z");
}

function ensureHttpdConfPath(candidate: string): string {
  const resolved = path.resolve(candidate);
  const directory = `${httpdConfDirectory}${path.sep}`;

  if (!resolved.startsWith(directory) || !resolved.endsWith(".conf")) {
    throw new Error(`Refusing to manage Apache vhost outside ${httpdConfDirectory}: ${candidate}`);
  }

  return resolved;
}

function resolveLiveVhostPath(binding: IamBindingSummary, serverName: string): string {
  const renderConfig = readObject(binding.config.render);
  const configured = readString(renderConfig?.liveVhost);

  if (configured) {
    return ensureHttpdConfPath(configured);
  }

  return ensureHttpdConfPath(path.join(httpdConfDirectory, `${serverName}.conf`));
}

function validateBindingForApacheApply(binding: IamBindingSummary): void {
  if (binding.providerSlug !== "pyrosa-iam" || binding.authMode !== "proxy") {
    throw new Error("Only Pyrosa IAM proxy bindings can be applied to Apache.");
  }

  if (binding.status !== "active") {
    throw new Error("Only active IAM bindings can be applied to Apache.");
  }

  if (binding.renderMode !== "apache_managed") {
    throw new Error("IAM binding renderMode must be apache_managed before apply.");
  }

  if (binding.providerProvisioningStatus !== "manual_ready") {
    throw new Error("IAM binding provider state must be manual_ready before apply.");
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function runRootApplyHelper(args: {
  sourcePath: string;
  liveVhostPath: string;
  rollbackDirectory: string;
}): Promise<void> {
  try {
    await execFileAsync("sudo", [
      "-n",
      applyHelperPath,
      args.sourcePath,
      args.liveVhostPath,
      args.rollbackDirectory
    ]);
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    throw new Error(
      `IAM Apache root apply failed: ${typeof stderr === "string" ? stderr.trim() : String(error)}`
    );
  }
}

export async function applyIamApacheBinding(
  binding: IamBindingSummary,
  now = new Date()
): Promise<IamApacheApplyResult> {
  validateBindingForApacheApply(binding);

  const rendered = renderPyrosaIamGatewayApacheVhost(binding);
  const liveVhostPath = resolveLiveVhostPath(binding, rendered.serverName);
  const stamp = timestampSegment(now);
  const rollbackDirectory = path.join(
    rollbackRoot,
    `iam-apache-${safeSegment(binding.bindingId)}-${stamp}`
  );
  const spoolPath = path.join(
    spoolRoot,
    `${safeSegment(binding.bindingId)}-${stamp}.conf`
  );
  const backupPath = path.join(rollbackDirectory, path.basename(liveVhostPath));
  const hadExistingLiveVhost = await pathExists(liveVhostPath);
  const contentSha256 = createHash("sha256").update(rendered.content).digest("hex");

  await mkdir(spoolRoot, { recursive: true });
  await writeFile(spoolPath, rendered.content, { mode: 0o640 });

  await runRootApplyHelper({
    sourcePath: spoolPath,
    liveVhostPath,
    rollbackDirectory
  });
  await rm(spoolPath, { force: true });

  const liveContent = await readFile(liveVhostPath, "utf8");

  if (
    normalizeApacheVhostForParity(liveContent) !==
    normalizeApacheVhostForParity(rendered.content)
  ) {
    throw new Error("Live Apache vhost differs from the rendered IAM vhost after apply.");
  }

  return {
    bindingId: binding.bindingId,
    providerSlug: binding.providerSlug,
    authMode: binding.authMode,
    targetKind: binding.targetKind,
    targetSlug: binding.targetSlug,
    serverName: rendered.serverName,
    upstreamUrl: rendered.upstreamUrl,
    certificateName: rendered.certificateName,
    liveVhostPath,
    backupPath: hadExistingLiveVhost ? backupPath : undefined,
    rollbackDirectory,
    contentSha256,
    renderedLineCount: normalizeApacheVhostForParity(rendered.content).split("\n").length,
    appliedAt: now.toISOString(),
    httpdSyntaxValidated: true,
    httpdReloaded: true
  };
}
