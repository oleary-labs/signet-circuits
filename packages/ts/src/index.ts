// @signet/circuits — compiled Signet zk circuit artifacts for UI consumers.
//
// The circuit bytecode and VK are written into dist/artifacts/ by the build step
// (scripts/copy-artifacts.mjs copies from <repo>/artifacts/jwt_auth/ into the package).
// Consumers should pair this package with the exact peer-dep versions of
// @aztec/bb.js and @noir-lang/noir_js declared here.
//
// Usage (UI):
//   import { jwt, TOOLCHAIN, assertBbJsVersion } from "@signet/circuits";
//   import { Noir } from "@noir-lang/noir_js";
//   import { UltraHonkBackend } from "@aztec/bb.js";
//
//   assertBbJsVersion();
//   const noir = new Noir(jwt.circuit);
//   const { witness } = await noir.execute(inputs);
//   const backend = new UltraHonkBackend(jwt.circuit.bytecode);
//   const proof = await backend.generateProof(witness);

import circuitJson from "./artifacts/jwt_auth/circuit.json" with { type: "json" };
import vk from "./artifacts/jwt_auth/vk.js"; // generated: exports Uint8Array
import metadata from "./artifacts/jwt_auth/metadata.json" with { type: "json" };

export const TOOLCHAIN = metadata.toolchain as {
  nargo: string;
  bb: string;
  bb_js: string;
  noir_js: string;
  noir_jwt_rev: string;
};

export const CIRCUIT_HASH: string = metadata.circuit_hash;
export const GIT_SHA: string = metadata.git_sha;

export const jwt = {
  circuit: circuitJson,
  vk,
  metadata,
} as const;

/**
 * Assert at runtime that the installed @aztec/bb.js version matches the one this
 * artifact bundle was built against. Call once at UI startup. Throws on mismatch.
 */
export async function assertBbJsVersion(): Promise<void> {
  // bb.js exposes its version via package.json or an exported constant depending
  // on the release. Do the check lazily so this module doesn't hard-depend on
  // bb.js being imported.
  try {
    // @ts-expect-error — resolved at runtime in consumer
    const pkg = await import("@aztec/bb.js/package.json", { with: { type: "json" } });
    const installed: string = pkg.default?.version ?? pkg.version;
    if (installed !== TOOLCHAIN.bb_js) {
      throw new Error(
        `@aztec/bb.js version mismatch: installed ${installed}, expected ${TOOLCHAIN.bb_js} ` +
          `(pinned by @signet/circuits). Proofs generated against a different bb.js may not ` +
          `verify. Align versions or bump @signet/circuits.`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("version mismatch")) throw err;
    // If we can't resolve the bb.js package.json, fall back to a soft warning
    // rather than blocking startup — the assertion is best-effort.
    // eslint-disable-next-line no-console
    console.warn("[@signet/circuits] could not verify bb.js version:", err);
  }
}
