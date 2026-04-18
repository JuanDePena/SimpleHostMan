import {
  diffCombinedControlReleaseRootStaging,
  formatCombinedControlReleaseRootStagingDiff
} from "./release-root-staging.js";

const workspaceRoot = process.argv[2];
const version = process.argv[3];

const diffed = await diffCombinedControlReleaseRootStaging({
  workspaceRoot,
  version,
  persist: true
});

console.log(formatCombinedControlReleaseRootStagingDiff(diffed.diffManifest));
