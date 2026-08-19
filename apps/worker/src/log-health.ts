import { execFile } from "node:child_process";
import { access, chmod, chown, mkdir, open, readdir, readlink, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface LogHealthReport {
  schemaVersion: "simplehost-log-health-v1";
  generatedAt: string;
  state: "ok" | "repaired" | "critical";
  service: string;
  activePath: string;
  pid?: number;
  openTargets: string[];
  actions: string[];
  errors: string[];
}

export function isExpectedLogTarget(target: string, activePath: string): boolean {
  return target === activePath;
}

async function servicePid(service: string): Promise<number | undefined> {
  const result = await execFileAsync("/usr/bin/systemctl", ["show", service, "-p", "MainPID", "--value"]);
  const pid = Number.parseInt(result.stdout.trim(), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

async function openTargets(pid: number): Promise<string[]> {
  const directory = `/proc/${pid}/fd`;
  const descriptors = await readdir(directory).catch(() => []);
  const targets = await Promise.all(
    descriptors.map((descriptor) => readlink(`${directory}/${descriptor}`).catch(() => undefined))
  );
  return targets.filter((target): target is string => target !== undefined);
}

async function ensureActiveFile(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "a", 0o600);
  await handle.close();
  await chmod(path, 0o600);
  await chown(path, 0, 0);
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function atomicWrite(path: string, report: LogHealthReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o640 });
  await rename(temporaryPath, path);
}

export async function runLogHealth(env: NodeJS.ProcessEnv = process.env): Promise<LogHealthReport> {
  const service = env.SIMPLEHOST_LOG_HEALTH_SERVICE ?? "rsyslog.service";
  const activePath = env.SIMPLEHOST_LOG_HEALTH_ACTIVE_PATH ?? "/var/log/messages";
  const report: LogHealthReport = {
    schemaVersion: "simplehost-log-health-v1",
    generatedAt: new Date().toISOString(),
    state: "ok",
    service,
    activePath,
    openTargets: [],
    actions: [],
    errors: []
  };

  try {
    let pid = await servicePid(service);

    if (pid === undefined) {
      throw new Error(`${service} has no running MainPID`);
    }

    report.pid = pid;
    report.openTargets = await openTargets(pid);
    const activeExists = await access(activePath).then(() => true).catch(() => false);
    let expectedOpen = report.openTargets.some((target) => isExpectedLogTarget(target, activePath));

    if (!activeExists || !expectedOpen) {
      await ensureActiveFile(activePath);
      report.actions.push(activeExists ? "active-file-revalidated" : "active-file-created");
      await execFileAsync("/usr/bin/systemctl", ["kill", "--signal=HUP", service]);
      report.actions.push("service-hup");
      await wait(750);
      pid = await servicePid(service);
      report.pid = pid;
      report.openTargets = pid === undefined ? [] : await openTargets(pid);
      expectedOpen = report.openTargets.some((target) => isExpectedLogTarget(target, activePath));

      if (!expectedOpen) {
        await execFileAsync("/usr/bin/systemctl", ["restart", service]);
        report.actions.push("service-restart");
        await wait(750);
        pid = await servicePid(service);
        report.pid = pid;
        report.openTargets = pid === undefined ? [] : await openTargets(pid);
        expectedOpen = report.openTargets.some((target) => isExpectedLogTarget(target, activePath));
      }

      if (!expectedOpen) {
        throw new Error(`${service} did not open ${activePath} after recovery`);
      }

      report.state = "repaired";
    }
  } catch (error) {
    report.state = "critical";
    report.errors.push(error instanceof Error ? error.message : "log health failed");
  }

  await atomicWrite(
    env.SIMPLEHOST_LOG_HEALTH_REPORT_PATH ?? "/var/lib/simplehost-log-health/latest.json",
    report
  );
  return report;
}
