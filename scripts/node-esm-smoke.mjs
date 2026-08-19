import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspacePackageNames = [
  "platform",
  "domain",
  "application",
  "infrastructure",
  "composition",
  "test-support",
];
const workspaceEntrypoints = workspacePackageNames.map((packageName) => `@livingsites/${packageName}`);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

for (const entrypoint of workspaceEntrypoints) {
  await import(entrypoint);
}

const composition = await import("@livingsites/composition");
assert.equal(typeof composition.composeProductionFromEnvironment, "function");
assert.equal(typeof composition.reconcileProductionAdministrator, "function");
assert.equal(typeof composition.AdminBootstrapError, "function");

const relativeSpecifierPattern = /(?:from\s*|import\s*\()(["'])(\.{1,2}\/[^"']+)\1/g;

for (const packageName of workspacePackageNames) {
  const distDirectory = path.join(repositoryRoot, "packages", packageName, "dist");
  for (const filePath of await listJavaScriptFiles(distDirectory)) {
    const source = await readFile(filePath, "utf8");
    for (const match of source.matchAll(relativeSpecifierPattern)) {
      const specifier = match[2];
      assert.match(
        specifier,
        /\.(?:js|mjs|cjs|json|node)$/,
        `${path.relative(repositoryRoot, filePath)} contains a non-Node-ESM relative specifier: ${specifier}`,
      );
    }
  }
}

console.log("Node ESM workspace entrypoint smoke test passed.");

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(entryPath));
    } else if (isRuntimeJavaScript(entry.name) && (await stat(entryPath)).isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function isRuntimeJavaScript(fileName) {
  return fileName.endsWith(".js")
    && !fileName.endsWith(".test.js")
    && !fileName.endsWith(".spec.js");
}
