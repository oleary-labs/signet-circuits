#!/usr/bin/env bash
# Install pinned nargo and bb versions from toolchain.json.
# Intended for local dev. CI uses the Dockerfile instead.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST="${REPO_ROOT}/toolchain.json"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "toolchain.json not found at ${MANIFEST}" >&2
  exit 1
fi

command -v jq >/dev/null || { echo "jq is required"; exit 1; }

NARGO_VERSION="$(jq -r .nargo "${MANIFEST}")"
BB_VERSION="$(jq -r .bb "${MANIFEST}")"

echo "Installing nargo ${NARGO_VERSION} via noirup..."
if ! command -v noirup >/dev/null; then
  curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
  export PATH="${HOME}/.nargo/bin:${PATH}"
fi
noirup -v "${NARGO_VERSION}"

echo "Installing bb ${BB_VERSION} via bbup..."
if ! command -v bbup >/dev/null; then
  curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/main/barretenberg/cpp/installation/install | bash
  export PATH="${HOME}/.bb:${PATH}"
fi
bbup -v "${BB_VERSION}"

echo
echo "Installed:"
nargo --version
bb --version
