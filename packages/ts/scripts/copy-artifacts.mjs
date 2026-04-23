#!/usr/bin/env node
// Copies compiled circuit artifacts into src/artifacts/ so tsc can resolve imports,
// and into dist/artifacts/ for the final package output.
// Run before tsc: "build": "node scripts/copy-artifacts.mjs && tsc"
//
// Source: ../../artifacts/jwt_auth/{circuit.json, metadata.json, vk}

import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const repoRoot = resolve(pkgRoot, "../..");
const artSrc = resolve(repoRoot, "artifacts/jwt_auth");

// Write into both src/ (for tsc resolution) and dist/ (for final output).
for (const base of ["src", "dist"]) {
  const dest = resolve(pkgRoot, base, "artifacts/jwt_auth");
  mkdirSync(dest, { recursive: true });

  // JSON artifacts — straight copy.
  for (const file of ["circuit.json", "metadata.json"]) {
    copyFileSync(resolve(artSrc, file), resolve(dest, file));
  }

  // VK — binary file → JS module exporting Uint8Array.
  const vkBytes = readFileSync(resolve(artSrc, "vk"));
  const encoded = Buffer.from(vkBytes).toString("base64");
  writeFileSync(
    resolve(dest, "vk.js"),
    [
      `const b64 = "${encoded}";`,
      `const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));`,
      `export default buf;`,
      "",
    ].join("\n"),
  );
}

console.log("artifacts copied to src/ and dist/");
