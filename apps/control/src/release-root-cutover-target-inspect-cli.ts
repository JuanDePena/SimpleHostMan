import { readFileSync } from "node:fs";

import {
  formatCombinedControlReleaseRootCutoverTargetApplyManifest,
  readCombinedControlReleaseRootCutoverTargetApplyManifest
} from "./release-root-cutover-target.js";
import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";
import {
  formatCombinedControlReleaseRootCutoverPlan,
  planCombinedControlReleaseRootCutover
} from "./release-root-cutover.js";
import {
  formatCombinedControlReleaseRootCutoverReady,
  runCombinedControlReleaseRootCutoverReady
} from "./release-root-cutover-ready.js";

const [workspaceRoot, targetId, version] = process.argv.slice(2);

const layout = createCombinedControlReleaseRootCutoverTargetLayout({
  workspaceRoot,
  targetId,
  version
});
const { planManifest } = await planCombinedControlReleaseRootCutover({
  workspaceRoot: layout.workspaceRoot,
  targetId: layout.targetId,
  version: layout.version,
  actualReleaseRoot: layout.releaseRoot
});
const { ready } = await runCombinedControlReleaseRootCutoverReady({
  workspaceRoot: layout.workspaceRoot,
  targetId: layout.targetId,
  version: layout.version,
  actualReleaseRoot: layout.releaseRoot
});
const applyManifest =
  await readCombinedControlReleaseRootCutoverTargetApplyManifest({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version
  });

console.log("Combined control release-root cutover target inspect");
console.log(`Target root: ${layout.targetRoot}`);
console.log(`Release root: ${layout.releaseRoot}`);
console.log("");
console.log(formatCombinedControlReleaseRootCutoverPlan(planManifest));
console.log("");
console.log(formatCombinedControlReleaseRootCutoverReady(ready));

if (applyManifest) {
  console.log("");
  console.log(formatCombinedControlReleaseRootCutoverTargetApplyManifest(applyManifest));
}

for (const filePath of [
  layout.cutoverPlanSummaryFile,
  layout.cutoverApplySummaryFile,
  layout.startupSummaryFile
]) {
  try {
    const content = readFileSync(filePath, "utf8").trim();
    if (content) {
      console.log("");
      console.log(content);
    }
  } catch {
    // summary not materialized yet
  }
}
