# signet-circuits docs

Design notes for the repo so we don't have to re-derive this from scratch next time a version drift bug shows up.

Read in this order:

1. [`architecture.md`](architecture.md) — why this repo exists, how the source-of-truth pattern works, the consumer flow end to end.
2. [`repo-layout.md`](repo-layout.md) — directory-by-directory walkthrough of what's in here and why.
3. [`toolchain.md`](toolchain.md) — how `nargo`, `bb`, `bb.js`, and `noir_js` are pinned, and how the Docker image flows downstream.
4. [`versioning.md`](versioning.md) — versioning policy and the release-to-consumers flow.
5. [`consumers.md`](consumers.md) — how the UI (TS) and bundler (Go) actually consume the packages, including startup version assertions.

## TL;DR

- `signet-circuits` owns the circuit source, the toolchain versions, and the build output.
- Protocol, UI, and bundler are **consumers** — they depend on released versions of this repo, and never run `nargo` or `bb` themselves (except the bundler, which shells out to the native `bb` it got from this repo's Docker image).
- One file — `toolchain.json` — pins every version. Change it, cut a release, bump downstream, redeploy in lockstep.
- Smoke tests cover native prove/verify, bb.js prove/verify, and cross-verification. Any failure blocks a release.
