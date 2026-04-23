#!/usr/bin/env node
// Verify a proof using @aztec/bb.js (UltraHonk) in Node.
//
// Usage: node scripts/verify_bbjs.mjs <circuit.json> <proof-dir>
//
// Expects <proof-dir>/proof and <proof-dir>/public_inputs.json to exist.
// Exits 0 on valid, 1 on invalid.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UltraHonkBackend } from "@aztec/bb.js";

const [circuitPath, proofDir] = process.argv.slice(2);
if (!circuitPath || !proofDir) {
  console.error("usage: verify_bbjs.mjs <circuit.json> <proof-dir>");
  process.exit(1);
}

const circuit = JSON.parse(readFileSync(resolve(circuitPath), "utf-8"));
const proofBytes = new Uint8Array(readFileSync(resolve(proofDir, "proof")));
const publicInputs = JSON.parse(readFileSync(resolve(proofDir, "public_inputs.json"), "utf-8"));

const backend = new UltraHonkBackend(circuit.bytecode);

console.log("bb.js: verifying proof…");
const valid = await backend.verifyProof({ proof: proofBytes, publicInputs });

if (valid) {
  console.log("bb.js: proof is VALID");
} else {
  console.error("bb.js: proof is INVALID");
  process.exit(1);
}
