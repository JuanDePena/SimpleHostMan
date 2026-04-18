import { readFile } from "node:fs/promises";

import {
  diffCombinedControlReleaseRootStaging,
  formatCombinedControlReleaseRootStagingApply,
  formatCombinedControlReleaseRootStagingDiff,
  formatCombinedControlReleaseRootStagingPlan,
  readCombinedControlReleaseRootStagingApplyManifest,
  readCombinedControlReleaseRootStagingPlanManifest
} from "./release-root-staging.js";
import { createCombinedControlReleaseRootStagingLayout } from "./release-root-staging-layout.js";

const workspaceRoot = process.argv[2];
const version = process.argv[3];

const layout = createCombinedControlReleaseRootStagingLayout({ workspaceRoot, version });
const [planManifest, applyManifest] = await Promise.all([
  readCombinedControlReleaseRootStagingPlanManifest({ workspaceRoot, version }),
  readCombinedControlReleaseRootStagingApplyManifest({ workspaceRoot, version })
]);
const diffed = await diffCombinedControlReleaseRootStaging({
  workspaceRoot,
  version,
  persist: true
});
const startupSummary = await readFile(layout.startupSummaryFile, "utf8").catch(() => "");

console.log("Combined control release-root staging layout");
console.log(`Actual release root: ${layout.actualReleaseRoot}`);
console.log(`Actual current root: ${layout.actualCurrentRoot}`);
console.log(`Staging root: ${layout.stagingRoot}`);
console.log(`Staging current root: ${layout.currentRoot}`);
console.log(`Staging release version root: ${layout.releaseVersionRoot}`);
console.log(`Plan manifest: ${layout.planManifestFile}`);
console.log(`Diff manifest: ${layout.diffManifestFile}`);
console.log(`Apply manifest: ${layout.applyManifestFile}`);
console.log();

if (planManifest) {
  console.log(formatCombinedControlReleaseRootStagingPlan(planManifest));
  console.log();
}

console.log(formatCombinedControlReleaseRootStagingDiff(diffed.diffManifest));
console.log();

if (applyManifest) {
  console.log(formatCombinedControlReleaseRootStagingApply(applyManifest));
  console.log();
}

if (startupSummary.trim().length > 0) {
  console.log(startupSummary.trimEnd());
}
