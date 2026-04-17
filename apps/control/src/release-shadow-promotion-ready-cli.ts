import {
  formatCombinedControlReleaseShadowPromotionReady,
  runCombinedControlReleaseShadowPromotionReady
} from "./release-shadow-promotion-ready.js";

const sandboxId = process.argv[2];
const version = process.argv[3];

const result = await runCombinedControlReleaseShadowPromotionReady({
  sandboxId,
  version
});

console.log(formatCombinedControlReleaseShadowPromotionReady(result));

if (result.status !== "PASS") {
  process.exitCode = 1;
}
