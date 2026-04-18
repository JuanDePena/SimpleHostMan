import { startCombinedControlReleaseRootCutoverTarget } from "./release-root-cutover-target-runner.js";

const [workspaceRoot, targetId, version] = process.argv.slice(2);

const runtime = await startCombinedControlReleaseRootCutoverTarget({
  workspaceRoot,
  targetId,
  version
});

console.log(`Combined control release-root cutover target started on ${runtime.origin}`);
