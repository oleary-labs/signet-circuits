# Repo layout

```
signet-circuits/
├── README.md
├── CHANGELOG.md
├── toolchain.json              # single source of truth for versions
├── .tool-versions              # asdf-compatible mirror of toolchain.json
├── Dockerfile                  # pinned-toolchain image, reused by bundler
├── scripts/
│   ├── install-toolchain.sh    # reads toolchain.json → installs nargo + bb
│   ├── build.sh                # nargo compile + bb write_vk → artifacts/
│   └── smoke.sh                # prove + verify, native and bb.js paths
├── circuits/
│   └── jwt/
│       ├── Nargo.toml          # noir-jwt pinned to a specific rev
│       ├── src/main.nr
│       └── tests/
├── zkbench/                    # benchmarking tool, migrated from signet-protocol
├── artifacts/                  # .gitignored; produced by build.sh
│   └── jwt/
│       ├── circuit.json        # ACIR bytecode
│       ├── vk                  # verification key (binary)
│       └── metadata.json       # circuit hash, git sha, toolchain versions
├── packages/
│   ├── ts/                     # @signet/circuits on npm (UI consumer)
│   └── go/                     # Go module (bundler consumer)
└── .github/workflows/
    ├── ci.yml
    └── release.yml
```

## Per-directory notes

### `toolchain.json`

The only file that should be edited to change toolchain versions. Everything else derives from it — the Dockerfile reads it at build time, the install script reads it at dev time, CI reads it to set Docker build args, and the build process copies it into `artifacts/<circuit>/metadata.json` so consumers get the same metadata embedded into their packages.

### `.tool-versions`

A convenience for local dev with `asdf` or `mise`. Values must match `toolchain.json`. Not canonical — if they drift, `toolchain.json` wins. CI ignores this file.

### `Dockerfile`

Builds `ghcr.io/signet-protocol/signet-circuits-toolchain:<version>`. Takes `NARGO_VERSION` and `BB_VERSION` as build args, set from `toolchain.json` in the release workflow. Downstream services (especially the bundler) use this as a base image, so toolchain updates propagate via a base-image tag bump.

### `scripts/install-toolchain.sh`

Local-dev install path. Installs `noirup` and `bbup` if absent, then uses them to pin `nargo` and `bb` to the `toolchain.json` versions. CI uses the Dockerfile instead — this script is for humans on laptops.

### `scripts/build.sh`

Asserts installed versions match `toolchain.json`. Compiles each circuit with `nargo compile`, generates a VK with `bb write_vk`, computes a SHA-256 hash over the concatenated bytecode + VK, writes `metadata.json` stamping everything (git sha, hash, toolchain). Output lands in `artifacts/<circuit>/`.

### `scripts/smoke.sh`

Placeholder for now. When wired up, it should run four proof flows — native prove/verify, bb.js prove/verify, native→bb.js cross-verify, bb.js→native cross-verify — and fail on any mismatch. Required to pass before a release can be cut.

### `circuits/`

Noir source. `jwt_auth/` is the current circuit. `Nargo.toml` pins `noir-jwt` to a specific commit or tag — never a branch. Adding a new circuit means adding a sibling directory and a line in `scripts/build.sh`.

### `zkbench/`

Benchmarking tool. Generates a self-signed JWT, computes circuit inputs, and benchmarks witness generation, proof generation, and verification using the native `bb` backend. Requires pre-built artifacts from `scripts/build.sh`.

### `artifacts/`

Build output. Gitignored. Never commit this — it's reproducible from source given the pinned toolchain. CI produces it as a build artifact and feeds it into the consumer-package jobs and the release upload.

### `packages/ts/`

`@signet/circuits` npm package. Ships the compiled bytecode, VK, and metadata as importable data. Peer-depends on `@aztec/bb.js` and `@noir-lang/noir_js` at exact pinned versions. Exports `assertBbJsVersion()` for runtime checks.

### `packages/go/`

Go module for the bundler. Uses `go:embed` to bake the artifacts into any binary that imports it, so the bundler doesn't need to locate files at runtime. Exports `AssertToolchain()` for the bundler to call at startup.

### `.github/workflows/`

`ci.yml` runs on every PR: install toolchain, build, nargo test, smoke, build consumer packages. `release.yml` runs on `v*.*.*` tags: build, smoke, push Docker image, publish npm package, tag the Go module path. Every consumer artifact comes out of one release run.
