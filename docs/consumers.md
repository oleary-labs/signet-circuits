# Consumer integration

How downstream repos should consume `signet-circuits`. The invariant across all consumers: **don't run `nargo` yourself, don't pick a `bb` or `bb.js` version, don't vendor artifacts.** Depend on a released version and use the package's exports.

## UI (TypeScript, browser)

Install:

```bash
npm install @signet/circuits @aztec/bb.js @noir-lang/noir_js
```

The peer dep versions on `@signet/circuits` pin the exact bb.js and noir_js to use. If the install warns about a peer-dep mismatch, **bump `@signet/circuits` — don't force-install a different bb.js**.

At startup:

```ts
import { assertBbJsVersion } from "@signet/circuits";

await assertBbJsVersion();
```

In the prove path:

```ts
import { jwt } from "@signet/circuits";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

async function prove(inputs: Inputs): Promise<Uint8Array> {
  const noir = new Noir(jwt.circuit);
  const { witness } = await noir.execute(inputs);
  const backend = new UltraHonkBackend(jwt.circuit.bytecode);
  const { proof } = await backend.generateProof(witness);
  return proof;
}
```

Emit `jwt.metadata.git_sha` and `jwt.metadata.toolchain.bb_js` as a metric or log line on app startup. Makes drift investigations trivial.

## Bundler (Go)

Module import:

```go
import circuits "github.com/signet-protocol/signet-circuits/packages/go"
```

Pin the version in `go.mod`:

```
require github.com/signet-protocol/signet-circuits/packages/go vX.Y.Z
```

At startup:

```go
if err := circuits.AssertToolchain(); err != nil {
    log.Fatalf("toolchain mismatch: %v", err)
}
```

The bundler's Dockerfile must use the matching toolchain image:

```dockerfile
FROM ghcr.io/signet-protocol/signet-circuits-toolchain:X.Y.Z AS runtime
# copy in the bundler binary
```

Use the same `X.Y.Z` as the Go module version.

### Prove path (shell out to native)

Pseudocode — the real implementation will want a pool, proper tempdir handling, and metrics.

```go
func Prove(ctx context.Context, inputs Inputs) ([]byte, error) {
    tmp, err := os.MkdirTemp("", "signet-prove-")
    if err != nil {
        return nil, err
    }
    defer os.RemoveAll(tmp)

    // Write the embedded circuit.json where nargo/bb can find it.
    circuitPath := filepath.Join(tmp, "circuit.json")
    if err := os.WriteFile(circuitPath, circuits.JWTCircuit, 0o600); err != nil {
        return nil, err
    }
    vkPath := filepath.Join(tmp, "vk")
    if err := os.WriteFile(vkPath, circuits.JWTVK, 0o600); err != nil {
        return nil, err
    }

    // 1. Generate witness with `nargo execute` (or use @noir-lang/noir_js via a
    //    Node subprocess if you want to drop nargo later).
    witnessPath := filepath.Join(tmp, "witness.gz")
    if err := runNargoExecute(ctx, tmp, inputs, witnessPath); err != nil {
        return nil, err
    }

    // 2. Prove with native bb.
    proofPath := filepath.Join(tmp, "proof")
    cmd := exec.CommandContext(ctx, "bb", "prove",
        "-b", circuitPath,
        "-w", witnessPath,
        "-o", proofPath,
    )
    if out, err := cmd.CombinedOutput(); err != nil {
        return nil, fmt.Errorf("bb prove: %w\n%s", err, out)
    }
    return os.ReadFile(proofPath)
}
```

### Verify path (optional)

If the bundler needs to verify proofs (say, sanity-check before accepting from another service):

```go
cmd := exec.CommandContext(ctx, "bb", "verify", "-k", vkPath, "-p", proofPath)
```

## Protocol

Currently no Solidity target. If the protocol ever needs the VK for off-chain verification, consume it via `packages/go` (import `circuits.JWTVK`) or add a new language-specific consumer package. Do not build your own.

## zkbench

Lives in this repo. Consumes artifacts directly from `artifacts/` during CI runs. Should be treated like a first-class consumer — if a toolchain bump regresses perf by more than the configured threshold, it blocks the release.

## Startup checklist for every consumer

1. Pin the `signet-circuits` package/module to an exact version.
2. Use the matching Docker base image (bundler) or exact peer-dep versions (UI).
3. Call the toolchain/version assertion at startup. Fail fast.
4. Log or export the embedded git sha and toolchain versions so they show up in dashboards.
5. On version bump: one-line dep change, redeploy.
