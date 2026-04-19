import {
  formatCombinedControlReleaseRootCutoverParity,
  runCombinedControlReleaseRootCutoverParity
} from "./release-root-cutover-parity.js";

const [, , workspaceRootArg, targetIdArg, versionArg, actualReleaseRootArg, previousVersionArg] =
  process.argv;

const result = await runCombinedControlReleaseRootCutoverParity({
  workspaceRoot: workspaceRootArg || undefined,
  targetId: targetIdArg || undefined,
  version: versionArg || undefined,
  actualReleaseRoot: actualReleaseRootArg || undefined,
  previousVersion: previousVersionArg || undefined,
  persist: true
});

console.log(formatCombinedControlReleaseRootCutoverParity(result.parity));
