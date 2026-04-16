import {
  formatCombinedControlReleaseSandboxPromotionReady,
  runCombinedControlReleaseSandboxPromotionReady
} from "./release-sandbox-promotion-ready.js";

const result = await runCombinedControlReleaseSandboxPromotionReady();

console.log(formatCombinedControlReleaseSandboxPromotionReady(result));

if (result.status !== "PASS") {
  process.exitCode = 1;
}
