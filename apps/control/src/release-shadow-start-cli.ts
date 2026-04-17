import { startCombinedControlReleaseShadow } from "./release-shadow-runner.js";

const runtime = await startCombinedControlReleaseShadow();

console.log(`Combined control release-shadow started on ${runtime.origin}`);
console.log(`Release root: ${runtime.packed.layout.releaseRoot}`);
console.log(`Current root: ${runtime.packed.layout.currentRoot}`);
console.log(runtime.startupSummary.trim());
console.log("");
console.log(runtime.shadowSummary.trim());
