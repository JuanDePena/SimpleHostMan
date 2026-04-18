import {
  registerCombinedControlReleaseRootStagingShutdown,
  startCombinedControlReleaseRootStaging
} from "./release-root-staging-runner.js";

const workspaceRoot = process.argv[2];
const version = process.argv[3];

const runtime = await startCombinedControlReleaseRootStaging({
  workspaceRoot,
  version
});
registerCombinedControlReleaseRootStagingShutdown(runtime);

console.log("Combined control release-root staging");
console.log(`Origin: ${runtime.origin}`);
console.log(`Actual release root: ${runtime.layout.actualReleaseRoot}`);
console.log(`Staging root: ${runtime.layout.stagingRoot}`);
console.log(`Current: ${runtime.layout.currentRoot}`);
console.log(`Startup summary: ${runtime.layout.startupSummaryFile}`);
console.log(`Apply summary: ${runtime.layout.applySummaryFile}`);
