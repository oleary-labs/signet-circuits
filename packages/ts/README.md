# @signet/circuits

Compiled Signet zk circuit artifacts (ACIR bytecode + verification key) plus pinned toolchain version constants. Consumed by the Signet UI.

## Install

```bash
npm install @signet/circuits @aztec/bb.js @noir-lang/noir_js
```

The peer dependency ranges in this package's `package.json` are tight. If npm/pnpm warns about a peer dep version mismatch, **do not override**: bump `@signet/circuits` instead. Different `bb.js` versions can produce proofs that don't verify against the VK this package ships.

## Usage

```ts
import { jwt, TOOLCHAIN, assertBbJsVersion } from "@signet/circuits";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

// Call once at startup; throws on bb.js version mismatch.
await assertBbJsVersion();

const noir = new Noir(jwt.circuit);
const { witness } = await noir.execute(inputs);
const backend = new UltraHonkBackend(jwt.circuit.bytecode);
const proof = await backend.generateProof(witness);
```

## What's in the package

- `jwt.circuit` — compiled ACIR JSON (bytecode + ABI).
- `jwt.vk` — verification key as `Uint8Array`.
- `jwt.metadata` — `{ git_sha, circuit_hash, toolchain }` stamped at build time.
- `TOOLCHAIN` — `{ nargo, bb, bb_js, noir_js, noir_jwt_rev }`.
- `CIRCUIT_HASH`, `GIT_SHA` — convenience re-exports.

## Do not

- **Do not** compile the circuit yourself. Depend on the package version.
- **Do not** mix `bb.js` versions across your app. This package's peer dep is the one source of truth.
- **Do not** copy `circuit.json` or `vk` out of the package at build time. Keep the import; the metadata travels with it.
