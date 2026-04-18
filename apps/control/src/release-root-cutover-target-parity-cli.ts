import {
  formatCombinedControlReleaseRootCutoverTargetParity,
  runCombinedControlReleaseRootCutoverTargetParity
} from "./release-root-cutover-target-parity.js";

const [workspaceRoot, targetId, version, previousVersion, actualReleaseRoot] =
  process.argv.slice(2);

const { parity } = await runCombinedControlReleaseRootCutoverTargetParity({
  workspaceRoot,
  targetId,
  version,
  previousVersion,
  actualReleaseRoot
});

console.log(formatCombinedControlReleaseRootCutoverTargetParity(parity));
