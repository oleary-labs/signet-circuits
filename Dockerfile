# Pinned zk toolchain image. Consumed by this repo's CI and by downstream services
# that need native nargo/bb at runtime (notably the bundler).
#
# Build:
#   docker build -t ghcr.io/signet-protocol/signet-circuits-toolchain:<version> .
#
# Downstream usage (bundler Dockerfile):
#   FROM ghcr.io/signet-protocol/signet-circuits-toolchain:<version>
#
# Versions are read from toolchain.json at build time via build args so there is
# exactly one place to update them.

FROM ubuntu:24.04

ARG NARGO_VERSION
ARG BB_VERSION

RUN test -n "$NARGO_VERSION" && test -n "$BB_VERSION" || \
    (echo "NARGO_VERSION and BB_VERSION build args are required" && exit 1)

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git bash jq build-essential libc++-dev \
    && rm -rf /var/lib/apt/lists/*

# Install noirup (installs a pinned nargo version)
RUN curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
ENV PATH="/root/.nargo/bin:${PATH}"
RUN noirup -v "${NARGO_VERSION}"

# Install bbup (installs a pinned bb version)
RUN curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
ENV PATH="/root/.bb:${PATH}"
RUN bbup -v "${BB_VERSION}"

# Sanity check: versions must resolve at build time
RUN nargo --version && bb --version

# Stamp the image with the versions it was built for, so downstream containers
# can assert at startup.
LABEL org.signet.nargo_version="${NARGO_VERSION}"
LABEL org.signet.bb_version="${BB_VERSION}"

WORKDIR /work
CMD ["/bin/bash"]
