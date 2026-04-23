---
name: protocol_integration
description: How signet-protocol consumes signet-circuits - embedded VK via Go module, bb CLI for verify
type: project
---

Protocol bundler now imports VK from signet-circuits Go module (embedded at build time). No more vk_path config.

**Why:** Eliminates manual VK distribution; circuit version is tied to Go module version.

**How to apply:** Bumping the circuit for protocol is `go get github.com/signet-protocol/signet-circuits/packages/go@<version>`. Currently using local `replace` directive until module is published. Protocol still shells out to `bb verify` — WASM replacement is deferred.
