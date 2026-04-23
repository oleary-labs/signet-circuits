#!/usr/bin/env node
// Generates a self-signed JWT test fixture and writes Prover.toml for the jwt circuit.
// The JWT mirrors real Google OIDC claim structure with RS256 signing.
//
// Usage: node scripts/generate-fixture.mjs [--out-dir circuits/jwt_auth]
//
// Outputs:
//   circuits/jwt_auth/tests/fixture.json  — JWT + public key + claims (for reference)
//   circuits/jwt_auth/Prover.toml         — circuit inputs ready for `nargo execute`

import { generateKeyPairSync, createSign } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CIRCUIT_DIR = process.argv.includes("--out-dir")
  ? resolve(process.argv[process.argv.indexOf("--out-dir") + 1])
  : join(REPO_ROOT, "circuits", "jwt_auth");

// --- Config ---
const MAX_DATA_LENGTH = 1024;
const MAX_CLAIM_LENGTH = 128;
const LIMB_BITS = 120n;
const NUM_LIMBS = 18;

// --- 1. Generate RSA-2048 key pair ---
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

// Extract modulus from JWK
const jwk = publicKey.export({ format: "jwk" });
const modulusBuf = Buffer.from(jwk.n, "base64url");
const modulusBigInt = bufToBigInt(modulusBuf);

// --- 2. Build JWT ---
const header = { alg: "RS256", typ: "JWT", kid: "test-fixture-key-001" };
const claims = {
  iss: "https://accounts.google.com",
  sub: "114810956681671373980",
  aud: "838237305140-bahhknj5sj8bir4sh8aenk4os6eua11j.apps.googleusercontent.com",
  azp: "838237305140-bahhknj5sj8bir4sh8aenk4os6eua11j.apps.googleusercontent.com",
  exp: 1893456000, // 2030-01-01
  iat: 1774048695,
  email: "paul@oleary.com",
  hd: "oleary.com",
  email_verified: true,
};

const headerB64 = base64url(JSON.stringify(header));
const payloadB64 = base64url(JSON.stringify(claims));
const signingInput = `${headerB64}.${payloadB64}`;

const signer = createSign("RSA-SHA256");
signer.update(signingInput);
const signature = signer.sign(privateKey);
const signatureB64 = signature.toString("base64url");

const jwt = `${signingInput}.${signatureB64}`;

// --- 3. Compute circuit inputs ---
const signatureBigInt = bufToBigInt(signature);
const redcParam = (1n << (2n * 2048n + 4n)) / modulusBigInt;

const modulusLimbs = splitToLimbs(modulusBigInt, LIMB_BITS, NUM_LIMBS);
const redcLimbs = splitToLimbs(redcParam, LIMB_BITS, NUM_LIMBS);
const signatureLimbs = splitToLimbs(signatureBigInt, LIMB_BITS, NUM_LIMBS);

const base64DecodeOffset = headerB64.length + 1;
const dataBytes = Buffer.from(signingInput, "utf-8");
if (dataBytes.length > MAX_DATA_LENGTH) {
  throw new Error(`Signed data (${dataBytes.length} bytes) exceeds MAX_DATA_LENGTH (${MAX_DATA_LENGTH})`);
}

// Pad to MAX_DATA_LENGTH
const dataStorage = new Array(MAX_DATA_LENGTH).fill(0);
for (let i = 0; i < dataBytes.length; i++) {
  dataStorage[i] = dataBytes[i];
}

// Dummy _session_pub (compressed secp256k1 point)
const sessionPub = new Array(33).fill(0);
sessionPub[0] = 0x02;
for (let i = 1; i < 33; i++) sessionPub[i] = i;

// --- 4. Write fixture.json ---
const testsDir = join(CIRCUIT_DIR, "tests");
mkdirSync(testsDir, { recursive: true });

const fixture = {
  description: "Self-signed RS256 JWT for smoke tests. Claims mirror Google OIDC structure.",
  raw: jwt,
  claims,
  jwk: { kty: jwk.kty, n: jwk.n, e: jwk.e, kid: header.kid },
};
const fixturePath = join(testsDir, "fixture.json");
writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
console.log(`wrote ${fixturePath}`);

// --- 5. Write Prover.toml ---
const proverPath = join(CIRCUIT_DIR, "Prover.toml");
writeFileSync(proverPath, buildProverToml());
console.log(`wrote ${proverPath}`);

// --- 6. Write circuit inputs as JSON (for bb.js / Noir JS) ---
// Noir JS ABI encoder accepts strings for large integers (u128).
const circuitInputs = {
  data: { storage: dataStorage, len: dataBytes.length },
  base64_decode_offset: base64DecodeOffset,
  redc_params_limbs: redcLimbs.map(String),
  signature_limbs: signatureLimbs.map(String),
  pubkey_modulus_limbs: modulusLimbs.map(String),
  expected_iss: boundedVec(claims.iss, MAX_CLAIM_LENGTH),
  expected_sub: boundedVec(claims.sub, MAX_CLAIM_LENGTH),
  expected_exp: claims.exp,
  expected_aud: boundedVec(claims.aud, MAX_CLAIM_LENGTH),
  expected_azp: boundedVec(claims.azp, MAX_CLAIM_LENGTH),
  _session_pub: sessionPub,
};
const inputsPath = join(testsDir, "circuit-inputs.json");
writeFileSync(inputsPath, JSON.stringify(circuitInputs) + "\n");
console.log(`wrote ${inputsPath}`);

// ---------- helpers ----------

function buildProverToml() {
  const lines = [];

  // Bare keys must come before [table] sections in TOML.
  lines.push(`base64_decode_offset = ${base64DecodeOffset}`);
  lines.push(`expected_exp = ${claims.exp}`);
  lines.push(`pubkey_modulus_limbs = [${limbsToToml(modulusLimbs)}]`);
  lines.push(`redc_params_limbs = [${limbsToToml(redcLimbs)}]`);
  lines.push(`signature_limbs = [${limbsToToml(signatureLimbs)}]`);
  lines.push(`_session_pub = [${sessionPub.join(", ")}]`);
  lines.push("");

  // BoundedVec tables
  lines.push(...boundedVecToml("data", dataStorage, dataBytes.length));
  lines.push(...boundedVecToml("expected_iss", claims.iss, MAX_CLAIM_LENGTH));
  lines.push(...boundedVecToml("expected_sub", claims.sub, MAX_CLAIM_LENGTH));
  lines.push(...boundedVecToml("expected_aud", claims.aud, MAX_CLAIM_LENGTH));
  lines.push(...boundedVecToml("expected_azp", claims.azp, MAX_CLAIM_LENGTH));

  return lines.join("\n") + "\n";
}

function boundedVecToml(name, value, maxLen) {
  let storage;
  let len;
  if (Array.isArray(value)) {
    // Already padded array (e.g. data)
    storage = value;
    len = arguments[2]; // maxLen is actually the real length for pre-padded arrays
    // For pre-padded data, the third arg is the real length
  } else {
    // String value — pad to maxLen
    const bytes = Buffer.from(value, "utf-8");
    len = bytes.length;
    storage = new Array(maxLen).fill(0);
    for (let i = 0; i < bytes.length; i++) storage[i] = bytes[i];
  }
  return [
    `[${name}]`,
    `storage = [${storage.join(", ")}]`,
    `len = ${len}`,
    "",
  ];
}

function boundedVec(strValue, maxLen) {
  const bytes = Buffer.from(strValue, "utf-8");
  const storage = new Array(maxLen).fill(0);
  for (let i = 0; i < bytes.length; i++) storage[i] = bytes[i];
  return { storage, len: bytes.length };
}

// For u128 limbs, Noir TOML expects quoted decimal strings.
function limbsToToml(limbs) {
  return limbs.map((l) => `"${l.toString()}"`).join(", ");
}

function splitToLimbs(n, chunkBits, numChunks) {
  const mask = (1n << chunkBits) - 1n;
  const limbs = [];
  let tmp = n;
  for (let i = 0; i < numChunks; i++) {
    limbs.push(tmp & mask);
    tmp >>= chunkBits;
  }
  return limbs;
}

function bufToBigInt(buf) {
  return BigInt("0x" + buf.toString("hex"));
}

function base64url(str) {
  return Buffer.from(str).toString("base64url");
}
