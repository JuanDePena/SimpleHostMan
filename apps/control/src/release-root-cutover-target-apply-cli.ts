import {
  applyCombinedControlReleaseRootCutoverTarget,
  formatCombinedControlReleaseRootCutoverTargetApplyManifest
} from "./release-root-cutover-target.js";
import { formatCombinedControlReleaseRootCutoverPlan } from "./release-root-cutover.js";

const [workspaceRoot, targetId, version] = process.argv.slice(2);

const applied = await applyCombinedControlReleaseRootCutoverTarget({
  workspaceRoot,
  targetId,
  version
});

console.log(formatCombinedControlReleaseRootCutoverPlan(applied.planManifest));
console.log("");
console.log(formatCombinedControlReleaseRootCutoverTargetApplyManifest(applied.applyManifest));
