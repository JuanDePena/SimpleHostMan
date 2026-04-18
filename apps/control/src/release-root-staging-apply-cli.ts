import {
  applyCombinedControlReleaseRootStaging,
  formatCombinedControlReleaseRootStagingApply,
  formatCombinedControlReleaseRootStagingPlan
} from "./release-root-staging.js";

const workspaceRoot = process.argv[2];
const version = process.argv[3];

const applied = await applyCombinedControlReleaseRootStaging({
  workspaceRoot,
  version
});

console.log("Combined control release-root staging");
console.log(`Actual release root: ${applied.layout.actualReleaseRoot}`);
console.log(`Staging root: ${applied.layout.stagingRoot}`);
console.log(`Staging current: ${applied.layout.currentRoot}`);
console.log(`Staging release version root: ${applied.layout.releaseVersionRoot}`);
console.log(`Plan manifest: ${applied.layout.planManifestFile}`);
console.log(`Apply manifest: ${applied.layout.applyManifestFile}`);
console.log();
console.log(formatCombinedControlReleaseRootStagingPlan(applied.planManifest));
console.log();
console.log(formatCombinedControlReleaseRootStagingApply(applied.applyManifest));
