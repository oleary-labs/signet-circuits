# signet-circuits / packages/go

Go module exposing the compiled Signet zk circuit artifacts to Go consumers (the bundler). Artifacts are embedded via `go:embed` so the consuming binary is self-contained.

## Install

```bash
go get github.com/signet-protocol/signet-circuits/packages/go@vX.Y.Z
```

Module versions are tagged as `packages/go/vX.Y.Z` in the repo, one per release.

## Usage (bundler)

```go
import (
    "log"

    circuits "github.com/signet-protocol/signet-circuits/packages/go"
)

func main() {
    // Fail fast if the host's nargo/bb versions don't match the embedded artifacts.
    if err := circuits.AssertToolchain(); err != nil {
        log.Fatalf("toolchain mismatch: %v", err)
    }

    // Write circuit.json and vk out to a temp dir and shell out to `nargo execute`
    // and `bb prove` to generate a proof. See docs/consumers.md for the full pattern.
    _ = circuits.JWTCircuit // []byte — ACIR JSON
    _ = circuits.JWTVK      // []byte — verification key
}
```

## What's embedded

- `circuits.JWTCircuit` — `[]byte` of `artifacts/jwt/circuit.json`.
- `circuits.JWTVK` — `[]byte` of `artifacts/jwt/vk`.
- `circuits.JWTMetadata()` — decoded `artifacts/jwt/metadata.json` with git SHA, circuit hash, and toolchain versions.

## Do not

- **Do not** vendor the artifacts into the bundler repo. Depend on this module version.
- **Do not** skip `AssertToolchain()`. Version drift between bb and the embedded VK = silently broken proofs.
