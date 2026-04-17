import {
  applyCombinedControlReleaseTarget,
  formatCombinedControlReleaseTargetApplyManifest
} from "./release-target-apply.js";

const [sandboxId, version] = process.argv.slice(2);

const applied = await applyCombinedControlReleaseTarget({
  sandboxId,
  version
});

console.log("Combined control release-target");
console.log(`Target root: ${applied.layout.targetRoot}`);
console.log(`Release root: ${applied.layout.releaseRoot}`);
console.log(`Current: ${applied.layout.currentRoot}`);
console.log(`Release version root: ${applied.layout.releaseVersionRoot}`);
console.log(`Apply manifest: ${applied.layout.applyManifestFile}`);
console.log("");
console.log(formatCombinedControlReleaseTargetApplyManifest(applied.applyManifest));
