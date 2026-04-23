// Package circuits exposes compiled Signet zk circuit artifacts to Go consumers
// (notably the bundler). Artifacts are embedded at build time from the repo's
// artifacts/ directory so the bundler binary is self-contained.
package circuits

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

// JWTCircuit is the compiled ACIR JSON for the Signet JWT circuit.
//
//go:embed artifacts/jwt_auth/circuit.json
var JWTCircuit []byte

// JWTVK is the verification key for the Signet JWT circuit.
//
//go:embed artifacts/jwt_auth/vk
var JWTVK []byte

//go:embed artifacts/jwt_auth/metadata.json
var jwtMetadataRaw []byte

// Metadata is stamped at build time from artifacts/<circuit>/metadata.json.
type Metadata struct {
	Circuit     string    `json:"circuit"`
	GitSHA      string    `json:"git_sha"`
	CircuitHash string    `json:"circuit_hash"`
	Toolchain   Toolchain `json:"toolchain"`
}

// Toolchain captures the exact versions used to produce the embedded artifacts.
type Toolchain struct {
	Nargo       string `json:"nargo"`
	BB          string `json:"bb"`
	BBJS        string `json:"bb_js"`
	NoirJS      string `json:"noir_js"`
	NoirJWTRev  string `json:"noir_jwt_rev"`
}

// JWTMetadata returns the build metadata for the JWT circuit.
func JWTMetadata() (Metadata, error) {
	var m Metadata
	if err := json.Unmarshal(jwtMetadataRaw, &m); err != nil {
		return Metadata{}, fmt.Errorf("decode jwt metadata: %w", err)
	}
	return m, nil
}
