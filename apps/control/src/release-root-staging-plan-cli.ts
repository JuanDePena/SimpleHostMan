import {
  formatCombinedControlReleaseRootStagingPlan,
  planCombinedControlReleaseRootStaging
} from "./release-root-staging.js";

const workspaceRoot = process.argv[2];
const version = process.argv[3];

const planned = await planCombinedControlReleaseRootStaging({
  workspaceRoot,
  version
});

console.log("Combined control release-root staging plan");
console.log(`Actual release root: ${planned.layout.actualReleaseRoot}`);
console.log(`Staging root: ${planned.layout.stagingRoot}`);
console.log(`Staging current: ${planned.layout.currentRoot}`);
console.log(`Staging release version root: ${planned.layout.releaseVersionRoot}`);
console.log();
console.log(formatCombinedControlReleaseRootStagingPlan(planned.planManifest));
