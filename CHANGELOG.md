# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Important:** any toolchain version change (`nargo`, `bb`, `bb.js`, `noir_js`) is treated as at least a minor version bump, because different backend versions can produce verification keys and proofs that are not interchangeable with older ones. Upgrades require downstream consumers to redeploy in lockstep. Call out toolchain bumps explicitly in the entry.

## [Unreleased]

### Added
- Initial repo scaffolding.
- `toolchain.json` as single source of truth for `nargo`, `bb`, `bb.js`, `noir_js` versions.
- `circuits/jwt_auth/` skeleton for the JWT circuit, depending on `noir-jwt`.
- `packages/ts/` placeholder for the `@signet/circuits` npm package.
- `packages/go/` placeholder for the Go consumer module.
- `zkbench/` placeholder for the benchmarking tool (to be migrated from `signet-protocol`).
- CI workflow skeletons for build + smoke + release.
- `docs/` with architecture, repo layout, toolchain, versioning, and consumer docs.
