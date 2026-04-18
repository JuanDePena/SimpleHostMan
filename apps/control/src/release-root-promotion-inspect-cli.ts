import { readFileSync } from "node:fs";

import {
  formatCombinedControlReleaseRootPromotionActivation,
  formatCombinedControlReleaseRootPromotionInventory,
  readCombinedControlReleaseRootPromotionInventory,
  resolveActiveCombinedControlReleaseRootPromotion
} from "./release-root-promotion-activation.js";
import {
  diffCombinedControlReleaseRootPromotion,
  formatCombinedControlReleaseRootPromotionApply,
  formatCombinedControlReleaseRootPromotionDiff,
  formatCombinedControlReleaseRootPromotionPlan,
  readCombinedControlReleaseRootPromotionApplyManifest,
  readCombinedControlReleaseRootPromotionPlanManifest
} from "./release-root-promotion.js";
import { createCombinedControlReleaseRootPromotionLayout } from "./release-root-promotion-layout.js";

const layout = createCombinedControlReleaseRootPromotionLayout();
const [planManifest, applyManifest, inventory] = await Promise.all([
  readCombinedControlReleaseRootPromotionPlanManifest(),
  readCombinedControlReleaseRootPromotionApplyManifest(),
  readCombinedControlReleaseRootPromotionInventory()
]);
const diffed = await diffCombinedControlReleaseRootPromotion({ persist: true });

console.log("Combined control release-root promotion inspect");
console.log(`Target root: ${layout.targetRoot}`);
console.log(`Actual release root: ${layout.actualReleaseRoot}`);
console.log(`Source staging root: ${layout.actualStagingRoot}`);
console.log("");

if (planManifest) {
  console.log(formatCombinedControlReleaseRootPromotionPlan(planManifest));
  console.log("");
}

console.log(formatCombinedControlReleaseRootPromotionDiff(diffed.diffManifest));
console.log("");

if (applyManifest) {
  console.log(formatCombinedControlReleaseRootPromotionApply(applyManifest));
  console.log("");
}

console.log(formatCombinedControlReleaseRootPromotionInventory(inventory));
console.log("");

try {
  const active = await resolveActiveCombinedControlReleaseRootPromotion();
  console.log(formatCombinedControlReleaseRootPromotionActivation(active.activation));
  console.log("");
} catch {
  console.log(`Activation unavailable: ${layout.activationManifestFile}`);
  console.log("");
}

try {
  console.log(readFileSync(layout.startupSummaryFile, "utf8").trim());
} catch {
  console.log(`Startup summary unavailable: ${layout.startupSummaryFile}`);
}
