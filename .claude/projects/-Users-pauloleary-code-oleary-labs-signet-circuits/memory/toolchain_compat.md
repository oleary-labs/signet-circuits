---
name: toolchain_compat
description: Known-good toolchain version combination for signet-circuits, and why beta.20 doesn't work yet
type: project
---

nargo 1.0.0-beta.15 + bb/bb.js 3.0.0-nightly.20251104 + noir-jwt v0.5.1 is the current known-good combination.

**Why not beta.20:** nargo 1.0.0-beta.20 removed `u1` type (replaced with `bool`), but noir-jwt v0.5.1's transitive dependencies (noir_base64, poseidon, noir-bignum, sha512, nodash) all use `u1`. Fixes exist on main branches but aren't tagged yet.

**How to apply:** When the ecosystem tags beta.20-compatible releases, bump toolchain.json and all downstream files in lockstep per docs/toolchain.md.
