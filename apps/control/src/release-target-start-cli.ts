import { startCombinedControlReleaseTarget } from "./release-target-runner.js";

const runtime = await startCombinedControlReleaseTarget();

console.log(`Combined control release-target started on ${runtime.origin}`);
console.log(`Release root: ${runtime.layout.releaseRoot}`);
console.log(`Current root: ${runtime.layout.currentRoot}`);
console.log(runtime.startupSummary.trim());
console.log("");
console.log(runtime.applySummary.trim());
