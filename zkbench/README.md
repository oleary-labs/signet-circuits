# zkbench

Benchmarking tool for the Signet ZK proof pipeline. Generates a self-signed RS256 JWT, computes circuit inputs, and times witness generation, proof generation, and verification using the native `bb` backend.

## Prerequisites

- `nargo` and `bb` installed at the versions pinned in `toolchain.json` (run `./scripts/install-toolchain.sh`)
- Circuit artifacts built (`./scripts/build.sh`)

## Usage

```sh
cd zkbench
go run .
```

## What it measures

| Step | Tool | What |
|------|------|------|
| Witness generation | `nargo execute` | Evaluates circuit with test inputs |
| Proof generation | `bb prove` (UltraHonk) | Full ZK proof from witness |
| Verification | `bb verify` | Checks proof against VK + public inputs |

Also reports proof size, VK size, and ACIR opcode count via `nargo info`.

## Sample output

```
Witness:     541ms
Prove:       1.57s
Verify:      25ms
Proof size:  16256 bytes
```

(Apple M-series, nargo 1.0.0-beta.15, bb 3.0.0-nightly.20251104)
