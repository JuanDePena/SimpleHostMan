import {
  formatCombinedControlReleaseShadowActivation,
  formatCombinedControlReleaseShadowInventory,
  readCombinedControlReleaseShadowInventory,
  resolveActiveCombinedControlReleaseShadow
} from "./release-shadow-activation.js";
import {
  formatCombinedControlReleaseShadowPromotion,
  formatCombinedControlReleaseShadowPromotionHistory,
  readCombinedControlReleaseShadowPromotionHistory,
  readCombinedControlReleaseShadowPromotionManifest
} from "./release-shadow-promotion.js";

const sandboxId = process.argv[2];
const inventory = await readCombinedControlReleaseShadowInventory({ sandboxId });
const promotionHistory = await readCombinedControlReleaseShadowPromotionHistory({
  sandboxId
});
const promotion = await readCombinedControlReleaseShadowPromotionManifest({
  sandboxId
});

console.log(formatCombinedControlReleaseShadowInventory(inventory));
console.log("");

try {
  const active = await resolveActiveCombinedControlReleaseShadow({ sandboxId });
  console.log(formatCombinedControlReleaseShadowActivation(active.activation));
  if (promotion) {
    console.log("");
    console.log(formatCombinedControlReleaseShadowPromotion(promotion));
  }
} catch {
  console.log("No active release-shadow activation found.");
}

console.log("");
console.log(formatCombinedControlReleaseShadowPromotionHistory(promotionHistory));
