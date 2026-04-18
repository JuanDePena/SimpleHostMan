import { runCombinedControlReleaseRootCutoverTargetHandoff } from "./release-root-cutover-target-handoff.js";
import { formatCombinedControlReleaseRootCutoverTargetHandoff } from "./release-root-cutover-target-handoff.js";

const [workspaceRoot, targetId, version, previousVersion, actualReleaseRoot] = process.argv.slice(2);

const { handoff } = await runCombinedControlReleaseRootCutoverTargetHandoff({
  workspaceRoot,
  targetId,
  version,
  previousVersion,
  actualReleaseRoot
});

console.log(formatCombinedControlReleaseRootCutoverTargetHandoff(handoff));
