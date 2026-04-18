import {
  formatCombinedControlReleaseRootCutoverTargetRehearsal,
  runCombinedControlReleaseRootCutoverTargetRehearsal
} from "./release-root-cutover-target-rehearsal.js";

const [workspaceRoot, targetId, version, previousVersion] = process.argv.slice(2);

const { rehearsal } = await runCombinedControlReleaseRootCutoverTargetRehearsal({
  workspaceRoot,
  targetId,
  version,
  previousVersion
});

console.log(formatCombinedControlReleaseRootCutoverTargetRehearsal(rehearsal));
