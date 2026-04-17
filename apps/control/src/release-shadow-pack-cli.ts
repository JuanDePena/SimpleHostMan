import { packCombinedControlReleaseShadow } from "./release-shadow-pack.js";
import { formatCombinedControlReleaseShadowManifest } from "./release-shadow-manifest.js";

const packed = await packCombinedControlReleaseShadow();

console.log("Combined control release-shadow");
console.log(`Shadow root: ${packed.layout.shadowRoot}`);
console.log(`Release root: ${packed.layout.releaseRoot}`);
console.log(`Current: ${packed.layout.currentRoot}`);
console.log(`Release version root: ${packed.layout.releaseVersionRoot}`);
console.log(`Release entrypoint: ${packed.layout.releaseEntrypoint}`);
console.log(`Current entrypoint: ${packed.layout.currentEntrypoint}`);
console.log(`Env file: ${packed.layout.envFile}`);
console.log("");
console.log(formatCombinedControlReleaseShadowManifest(packed.manifest));
