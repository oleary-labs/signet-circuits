#!/usr/bin/env bash
# Build circuit artifacts. Produces artifacts/<circuit>/{circuit.json, vk, metadata.json}.
# Reads pinned versions from toolchain.json and asserts installed tools match.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST="${REPO_ROOT}/toolchain.json"

command -v jq >/dev/null || { echo "jq is required"; exit 1; }

EXPECTED_NARGO="$(jq -r .nargo "${MANIFEST}")"
EXPECTED_BB="$(jq -r .bb "${MANIFEST}")"

assert_version() {
  local tool="$1" expected="$2" actual
  actual="$(${tool} --version 2>&1 | head -n1)"
  if [[ "${actual}" != *"${expected}"* ]]; then
    echo "ERROR: ${tool} version mismatch." >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    echo "  run: ./scripts/install-toolchain.sh" >&2
    exit 1
  fi
}

assert_version nargo "${EXPECTED_NARGO}"
assert_version bb "${EXPECTED_BB}"

CIRCUITS=("jwt_auth")
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo "unknown")"

for circuit in "${CIRCUITS[@]}"; do
  echo "==> building circuit: ${circuit}"
  SRC_DIR="${REPO_ROOT}/circuits/${circuit}"
  OUT_DIR="${REPO_ROOT}/artifacts/${circuit}"
  mkdir -p "${OUT_DIR}"

  (cd "${SRC_DIR}" && nargo compile)

  # nargo writes to ./target/*.json; copy to artifacts/
  cp "${SRC_DIR}/target/${circuit}.json" "${OUT_DIR}/circuit.json"

  # Generate verification key with bb.
  # bb write_vk outputs a directory with vk and vk_hash files inside.
  bb write_vk -b "${OUT_DIR}/circuit.json" -o "${OUT_DIR}/vk_dir"
  mv "${OUT_DIR}/vk_dir/vk" "${OUT_DIR}/vk"
  rm -rf "${OUT_DIR}/vk_dir"

  # Circuit hash = sha256 over ACIR bytecode + VK. Useful for sanity checks.
  CIRCUIT_HASH="$(cat "${OUT_DIR}/circuit.json" "${OUT_DIR}/vk" | shasum -a 256 | awk '{print $1}')"

  cat > "${OUT_DIR}/metadata.json" <<EOF
{
  "circuit": "${circuit}",
  "git_sha": "${GIT_SHA}",
  "circuit_hash": "${CIRCUIT_HASH}",
  "toolchain": $(cat "${MANIFEST}")
}
EOF

  echo "    artifacts/${circuit}/{circuit.json, vk, metadata.json}"

  # Copy into Go package for embedding.
  GO_ART="${REPO_ROOT}/packages/go/artifacts/${circuit}"
  mkdir -p "${GO_ART}"
  cp "${OUT_DIR}/circuit.json" "${OUT_DIR}/vk" "${OUT_DIR}/metadata.json" "${GO_ART}/"

  # Copy circuit source files for bundler witness generation (nargo execute).
  GO_SRC="${REPO_ROOT}/packages/go/source/${circuit}"
  mkdir -p "${GO_SRC}/src"
  cp "${SRC_DIR}/Nargo.toml" "${GO_SRC}/"
  cp "${SRC_DIR}/src/main.nr" "${GO_SRC}/src/"
  echo "    packages/go/{artifacts,source}/${circuit}/ (updated)"
done

echo "done."
