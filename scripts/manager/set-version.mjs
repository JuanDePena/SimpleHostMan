#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

execFileSync(
  process.execPath,
  [path.join(workspaceRoot, "scripts", "set-version.mjs"), ...process.argv.slice(2)],
  {
    stdio: "inherit"
  }
);
