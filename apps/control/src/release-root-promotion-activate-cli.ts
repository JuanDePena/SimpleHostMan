import {
  activateCombinedControlReleaseRootPromotionVersion,
  formatCombinedControlReleaseRootPromotionActivation
} from "./release-root-promotion-activation.js";

const [, , versionArg, targetIdArg] = process.argv;

if (!versionArg) {
  throw new Error("Usage: node dist/release-root-promotion-activate-cli.js <version> [targetId]");
}

const activation = await activateCombinedControlReleaseRootPromotionVersion({
  version: versionArg,
  targetId: targetIdArg
});

console.log(formatCombinedControlReleaseRootPromotionActivation(activation));
