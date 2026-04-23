# signet-circuits

Source of truth for the Signet zk pipeline. This repo owns the Noir circuit source, pins the exact `nargo` and `bb` (Barretenberg) versions used to build it, and publishes the compiled artifacts as versioned packages that downstream consumers (UI, bundler) depend on.

Nothing outside this repo should ever run `nargo` or `bb` directly. If you find yourself doing so, that's a bug to fix here, not there.

## What lives here

- **`circuits/`** — Noir source. Currently just `jwt/`, built on top of `noir-jwt`.
- **`zkbench/`** — benchmarking tool (migrated from `signet-protocol`).
- **`packages/ts/`** — `@signet/circuits` npm package. Consumed by the UI.
- **`packages/go/`** — Go module. Consumed by the bundler.
- **`artifacts/`** — compiled circuit bytecode + verification key. Gitignored; built by CI.
- **`toolchain.json`** — the single source of truth for `nargo`, `bb`, `bb.js`, and `noir_js` versions. Everything else derives from this file.
- **`docs/`** — design docs. Start at `docs/README.md`.

## Quickstart

```bash
# Install pinned toolchain (reads toolchain.json)
./scripts/install-toolchain.sh

# Build circuit artifacts → artifacts/jwt/
./scripts/build.sh

# Run smoke test (prove + verify, native and bb.js paths)
./scripts/smoke.sh
```

## Docker

The repo ships a `Dockerfile` that installs the pinned toolchain. Downstream services (notably the bundler, which needs native `nargo` + `bb`) should use this as a base image:

```dockerfile
FROM ghcr.io/signet-protocol/signet-circuits-toolchain:1.2.3
```

Bumping the circuits release version in the bundler is then a one-line change.

## Releasing

See [`docs/versioning.md`](docs/versioning.md) for the full story. Short version: tag `vX.Y.Z` → CI builds artifacts → publishes `@signet/circuits@X.Y.Z` to npm, tags the Go module, pushes the Docker image. Consumers bump one dep and redeploy.

## Further reading

- [`docs/architecture.md`](docs/architecture.md) — why this repo exists, how the source-of-truth pattern works.
- [`docs/repo-layout.md`](docs/repo-layout.md) — walkthrough of every directory and file.
- [`docs/toolchain.md`](docs/toolchain.md) — how toolchain pinning works end to end.
- [`docs/versioning.md`](docs/versioning.md) — versioning policy and release flow.
- [`docs/consumers.md`](docs/consumers.md) — how the UI and bundler consume this repo.
