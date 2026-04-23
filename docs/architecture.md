# Architecture

## The problem this repo solves

The Signet zk pipeline has three consumer repos that all have to agree on a set of toolchain versions or proofs silently stop verifying:

- **Protocol** — (no Solidity target; included here for completeness — may consume the VK for off-chain verification).
- **UI** — generates proofs in-browser with `@aztec/bb.js`.
- **Bundler** — written in Go, shells out to native `nargo` and `bb` for server-side proving (native is ~3x faster than bb.js here, which is why we pay the native-toolchain tax in the bundler).

The recent bb.js / native `bb` skew incident was the consequence of having no single place that owned these versions. Each repo's CI and Dockerfile made independent decisions about which toolchain to install, and when one drifted the others didn't know.

## The pattern

`signet-circuits` is the **single source of truth** for the zk pipeline. It owns:

- The Noir circuit source (`circuits/`).
- The exact pinned versions of `nargo`, `bb`, `bb.js`, and `noir_js` (`toolchain.json`).
- The build process that turns the above into artifacts (`scripts/build.sh`).
- The compiled artifacts themselves, published as versioned packages for each consumer language.
- A pinned Docker image that bakes the native toolchain, so the bundler can inherit it.

Everything else is a consumer. Consumers never compile the circuit, never choose a `bb` version, and never bring their own `bb.js`.

## End-to-end flow

```
                           ┌─────────────────────────────┐
                           │       signet-circuits       │
                           │                             │
                           │  circuits/jwt_auth/*.nr (source) │
                           │  toolchain.json  (versions) │
                           └──────────────┬──────────────┘
                                          │
                            ./scripts/build.sh (in CI)
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 ▼                        ▼                        ▼
     artifacts/jwt_auth/circuit.json   artifacts/jwt_auth/vk      artifacts/jwt_auth/metadata.json
                 │                        │                        │
                 └────────────────────────┼────────────────────────┘
                                          │
                              Tag vX.Y.Z → release.yml
                                          │
          ┌───────────────────┬───────────┼───────────────┬────────────────────┐
          ▼                   ▼           ▼               ▼                    ▼
  @signet/circuits    packages/go/vX.Y.Z  Docker image  (optional: VK      (future: more
  on npm                                  on GHCR        artifact for       consumer pkgs)
          │                   │               │          off-chain verify)
          ▼                   ▼               ▼
        UI                Bundler       Bundler Dockerfile
   (browser proving)  (embedded bytecode  inherits native
                       + native bb)        toolchain
```

The key property: every arrow carries a version number derived from the same release tag. When the bundler starts, it calls `circuits.AssertToolchain()`, which compares the embedded `metadata.toolchain.bb` against `bb --version` on the host. Those match because the host's `bb` came from the same tagged Docker image that produced the artifacts. One version source, one release, aligned consumers.

## Why this works

1. **One place to change versions.** Every toolchain-related file in the repo reads from `toolchain.json`. No one has to grep across three repos to find the answer to "which `bb` version are we on?"
2. **Impossible-to-ignore drift detection.** Consumer packages carry the toolchain metadata with them. Consumers assert at startup. Mismatched versions fail loudly instead of producing proofs that silently fail to verify.
3. **Atomic releases.** A single tag produces every consumer artifact (npm package, Go module, Docker image). Downstream repos bump in lockstep because everything moves together.
4. **Reproducible builds.** The Dockerfile pins every version. CI and local dev produce identical artifacts from the same source.
5. **Room for more circuits.** `circuits/` is structured for multiple circuits from day one. Adding one later is adding a directory; the release pipeline picks it up via `scripts/build.sh`.

## What this repo doesn't own

- Runtime proving code in the UI (lives in the UI repo; just imports `@signet/circuits`).
- Runtime proving code in the bundler (lives in the bundler repo; just imports `packages/go`).
- Any deployment of verifiers or on-chain components (Solidity is not a target).
- Application-level input construction (e.g. JWT parsing, session derivation) — these consume the circuit but don't belong to it.
