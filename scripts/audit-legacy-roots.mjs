#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoreDirs = new Set(['.git', 'node_modules', 'dist', '.tmp']);
const ignoreExtensions = new Set(['.md', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.map', '.lock']);
const ignoreBasenames = new Set(['pnpm-lock.yaml', 'audit-legacy-roots.mjs']);
const forbiddenPatterns = [
  { label: '/opt/simplehostman/repos', regex: /\/opt\/simplehostman\/repos\//g },
  { label: '/opt/simplehost/repos', regex: /\/opt\/simplehost\/repos\//g },
  { label: '@simplehost/panel-*', regex: /@simplehost\/panel-/g },
  { label: '@simplehost/manager-*', regex: /@simplehost\/manager-/g },
  { label: 'packages/panel-*', regex: /packages\/panel-/g },
  { label: 'packages/manager-*', regex: /packages\/manager-/g },
  { label: 'scripts/panel', regex: /scripts\/panel/g },
  { label: 'scripts/manager', regex: /scripts\/manager/g },
  { label: 'tsconfig.panel.json', regex: /tsconfig\.panel\.json/g },
  { label: 'tsconfig.manager.json', regex: /tsconfig\.manager\.json/g }
];
const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignoreDirs.has(entry)) {
      continue;
    }
    const fullPath = path.join(dir, entry);
    const relativePath = path.relative(root, fullPath);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (ignoreBasenames.has(path.basename(fullPath))) {
      continue;
    }
    if (ignoreExtensions.has(path.extname(fullPath))) {
      continue;
    }
    const content = readFileSync(fullPath, 'utf8');
    for (const { label, regex } of forbiddenPatterns) {
      regex.lastIndex = 0;
      if (regex.test(content)) {
        findings.push({ relativePath, label });
      }
    }
  }
}

walk(root);

if (findings.length > 0) {
  console.error('Forbidden legacy-root or legacy-package references found outside documentation/build artifacts:');
  for (const finding of findings) {
    console.error(`- ${finding.relativePath}: ${finding.label}`);
  }
  process.exit(1);
}

console.log('No forbidden legacy-root or legacy-package references found outside documentation/build artifacts.');
