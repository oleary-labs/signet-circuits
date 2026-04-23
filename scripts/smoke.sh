#!/usr/bin/env bash
# Smoke test: prove + verify via both the native path (bb) and the JS path (bb.js),
# plus cross-verification (prove with one, verify with the other). Any failure blocks
# a release because it means the bundler and UI would produce/accept incompatible proofs.
#
# Expects ./scripts/build.sh to have been run first.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ART_DIR="${REPO_ROOT}/artifacts/jwt_auth"
CIRCUIT_DIR="${REPO_ROOT}/circuits/jwt_auth"

if [[ ! -f "${ART_DIR}/circuit.json" ]]; then
  echo "No artifacts found. Run ./scripts/build.sh first." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# ---------- 0. Generate fixture inputs ----------
echo "==> Generating test fixture"
node "${SCRIPT_DIR}/generate-fixture.mjs" --out-dir "${CIRCUIT_DIR}"

# ---------- 1. Witness generation ----------
echo "==> Generating witness"
(cd "${CIRCUIT_DIR}" && nargo execute smoke_witness)
WITNESS="${CIRCUIT_DIR}/target/smoke_witness.gz"

if [[ ! -f "${WITNESS}" ]]; then
  echo "ERROR: witness not generated at ${WITNESS}" >&2
  exit 1
fi

# ---------- 2. Native bb prove ----------
echo "==> Proving with native bb (UltraHonk)"
bb prove \
  -b "${ART_DIR}/circuit.json" \
  -w "${WITNESS}" \
  -o "${WORK}/native" \
  --write_vk

# bb writes proof and vk into the output directory
echo "    native proof: $(wc -c < "${WORK}/native/proof" | tr -d ' ') bytes"

# ---------- 3. Native bb verify ----------
echo "==> Verifying with native bb"
bb verify \
  -k "${WORK}/native/vk" \
  -p "${WORK}/native/proof" \
  -i "${WORK}/native/public_inputs"
echo "    native verify: OK"

# ---------- 4. bb.js prove ----------
echo "==> Proving with bb.js (Node)"
node "${SCRIPT_DIR}/prove_bbjs.mjs" \
  "${ART_DIR}/circuit.json" \
  "${CIRCUIT_DIR}/tests/circuit-inputs.json" \
  "${WORK}/bbjs"

echo "    bb.js proof: $(wc -c < "${WORK}/bbjs/proof" | tr -d ' ') bytes"

# ---------- 5. bb.js verify ----------
echo "==> Verifying with bb.js"
node "${SCRIPT_DIR}/verify_bbjs.mjs" \
  "${ART_DIR}/circuit.json" \
  "${WORK}/bbjs"

# ---------- 6. Cross-verification ----------
echo "==> Cross-verify: native proof → bb.js verify"
# Native bb writes binary public_inputs; bb.js verify needs public_inputs.json.
# Convert: read 32-byte BE field elements → hex strings.
node -e "
  const fs = require('fs');
  const buf = fs.readFileSync('${WORK}/native/public_inputs');
  const pis = [];
  for (let i = 0; i < buf.length; i += 32) {
    pis.push('0x' + buf.subarray(i, i + 32).toString('hex'));
  }
  fs.writeFileSync('${WORK}/native/public_inputs.json', JSON.stringify(pis));
"
node "${SCRIPT_DIR}/verify_bbjs.mjs" \
  "${ART_DIR}/circuit.json" \
  "${WORK}/native"

echo "==> Cross-verify: bb.js proof → native verify"
bb verify \
  -k "${WORK}/bbjs/vk" \
  -p "${WORK}/bbjs/proof" \
  -i "${WORK}/bbjs/public_inputs"
echo "    cross-verify: OK"

# ---------- Summary ----------
echo
echo "=== Smoke test passed ==="
echo "  native prove + verify:  OK"
echo "  bb.js prove + verify:   OK"
echo "  native → bb.js verify:  OK"
echo "  bb.js → native verify:  OK"
