import {
  formatCombinedControlReleaseRootPromotionReady,
  runCombinedControlReleaseRootPromotionReady
} from "./release-root-promotion-ready.js";

const result = await runCombinedControlReleaseRootPromotionReady();
console.log(formatCombinedControlReleaseRootPromotionReady(result));
