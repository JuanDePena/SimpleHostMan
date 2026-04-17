import {
  formatCombinedControlReleaseShadowHandoffResult,
  runCombinedControlReleaseShadowHandoff
} from "./release-shadow-handoff-runner.js";

const [sandboxId, version] = process.argv.slice(2);

const result = await runCombinedControlReleaseShadowHandoff({
  sandboxId,
  version
});

console.log(formatCombinedControlReleaseShadowHandoffResult(result));

if (result.status !== "PASS") {
  process.exitCode = 1;
}
