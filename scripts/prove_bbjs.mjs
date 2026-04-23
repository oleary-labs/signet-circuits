#!/usr/bin/env node
// Prove a JWT circuit using @noir-lang/noir_js + @aztec/bb.js (UltraHonk) in Node.
// Mirrors what the UI does: execute circuit with inputs → generate proof.
//
// Usage: node scripts/prove_bbjs.mjs <circuit.json> <circuit-inputs.json> <out-dir>
//
// Writes proof, vk, and public_inputs to <out-dir>/.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

const [circuitPath, inputsPath, outDir] = process.argv.slice(2);
if (!circuitPath || !inputsPath || !outDir) {
  console.error("usage: prove_bbjs.mjs <circuit.json> <circuit-inputs.json> <out-dir>");
  process.exit(1);
}

const circuit = JSON.parse(readFileSync(resolve(circuitPath), "utf-8"));
const inputs = JSON.parse(readFileSync(resolve(inputsPath), "utf-8"));

const noir = new Noir(circuit);
const backend = new UltraHonkBackend(circuit.bytecode);

console.log("bb.js: executing circuit (witness generation)…");
const { witness } = await noir.execute(inputs);

console.log("bb.js: generating proof…");
const proof = await backend.generateProof(witness);

mkdirSync(resolve(outDir), { recursive: true });
writeFileSync(resolve(outDir, "proof"), Buffer.from(proof.proof));

const vk = await backend.getVerificationKey();
writeFileSync(resolve(outDir, "vk"), Buffer.from(vk));

// Write public inputs in both formats:
// 1. JSON array of hex strings (for bb.js verify)
// 2. Binary concatenated 32-byte BE field elements (for native bb verify)
if (proof.publicInputs) {
  writeFileSync(resolve(outDir, "public_inputs.json"), JSON.stringify(proof.publicInputs));

  const piBytes = Buffer.alloc(proof.publicInputs.length * 32);
  for (let i = 0; i < proof.publicInputs.length; i++) {
    let val = BigInt(proof.publicInputs[i]);
    const buf = Buffer.alloc(32);
    for (let j = 31; j >= 0; j--) {
      buf[j] = Number(val & 0xffn);
      val >>= 8n;
    }
    buf.copy(piBytes, i * 32);
  }
  writeFileSync(resolve(outDir, "public_inputs"), piBytes);
}

console.log(`bb.js: proof written to ${outDir}/`);
