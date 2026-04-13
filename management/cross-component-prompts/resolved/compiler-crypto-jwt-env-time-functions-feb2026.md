Component: clean-language-compiler
Issue Type: compatibility
Priority: critical
Description: |
  The clean-server host bridge has renamed 4 crypto functions, added 6 new crypto/JWT functions,
  and added 2 new environment/time functions. The compiler must update its import generation
  to use the new names and signatures. These are Layer 2 (host-bridge) functions enforced by
  the WAT spec compliance guard at clean-server/host-bridge/tests/spec_compliance.wat.

Context: |
  During the host-bridge ↔ plugin function alignment audit (Categories 2 & 3), all crypto
  functions were renamed to use the `_crypto_*` prefix (matching framework plugin declarations),
  and missing JWT/env/time functions were implemented. The old function names no longer exist
  in the server.

## Renamed Functions (4)

The compiler MUST update any import generation that references these old names:

| Old Name | New Name | Signature (unchanged) |
|----------|----------|-----------------------|
| `_auth_hash_password` | `_crypto_hash_password` | `(ptr: i32, len: i32) -> i32` |
| `_auth_verify_password` | `_crypto_verify_password` | `(ptr: i32, len: i32, ptr: i32, len: i32) -> i32` |
| `crypto_random_bytes` | `_crypto_random_bytes` | `(i32) -> i32` |
| `crypto_sha256` | `_crypto_hash_sha256` | `(ptr: i32, len: i32) -> i32` |

## New Functions (8)

These functions are now available in the host bridge and should be recognized by the compiler:

### Crypto (3 new)

| Function | Signature | Description |
|----------|-----------|-------------|
| `_crypto_random_hex` | `(len: i32) -> i32` | Generate random hex string |
| `_crypto_hash_sha512` | `(data_ptr: i32, data_len: i32) -> i32` | SHA-512 hash |
| `_crypto_hmac` | `(data_ptr: i32, data_len: i32, key_ptr: i32, key_len: i32, algo_ptr: i32, algo_len: i32) -> i32` | HMAC digest |

### JWT (3 new)

| Function | Signature | Description |
|----------|-----------|-------------|
| `_jwt_sign` | `(payload_ptr: i32, payload_len: i32, secret_ptr: i32, secret_len: i32, algo_ptr: i32, algo_len: i32) -> i32` | Sign JWT |
| `_jwt_verify` | `(token_ptr: i32, token_len: i32, secret_ptr: i32, secret_len: i32, algo_ptr: i32, algo_len: i32) -> i32` | Verify JWT |
| `_jwt_decode` | `(token_ptr: i32, token_len: i32) -> i32` | Decode JWT without verification |

### Environment (1 new)

| Function | Signature | Description |
|----------|-----------|-------------|
| `_env_get` | `(name_ptr: i32, name_len: i32) -> i32` | Get environment variable |

### Time (1 new)

| Function | Signature | Description |
|----------|-----------|-------------|
| `_time_now` | `() -> i64` | Unix timestamp (seconds since epoch) |

## Layer 3 Session Function Changes

These are server-only (Layer 3) functions. The compiler should update its bridge function map:

| Old Name | New Name | New Signature |
|----------|----------|---------------|
| `_session_create` | `_session_store` | `(id_ptr: i32, id_len: i32, data_ptr: i32, data_len: i32) -> i32` |
| `_session_get` (no params) | `_session_get` | `(id_ptr: i32, id_len: i32) -> i32` |
| `_session_destroy` (no params) | `_session_delete` | `(id_ptr: i32, id_len: i32) -> i32` |
| `_session_set_cookie` | `_http_set_cookie` | `(name_ptr: i32, name_len: i32, value_ptr: i32, value_len: i32, opts_ptr: i32, opts_len: i32) -> i32` |

New Layer 3 functions:

| Function | Signature |
|----------|-----------|
| `_session_exists` | `(id_ptr: i32, id_len: i32) -> i32` |
| `_session_set_csrf` | `(token_ptr: i32, token_len: i32) -> i32` |
| `_session_get_csrf` | `() -> i32` |
| `_roles_register` | `(json_ptr: i32, json_len: i32) -> i32` |
| `_role_has_permission` | `(role_ptr: i32, role_len: i32, perm_ptr: i32, perm_len: i32) -> i32` |
| `_role_get_permissions` | `(role_ptr: i32, role_len: i32) -> i32` |

## Authoritative Reference

- WAT spec: `clean-server/host-bridge/tests/spec_compliance.wat`
- Host Bridge docs: `platform-architecture/HOST_BRIDGE.md`
- Server Extensions docs: `platform-architecture/SERVER_EXTENSIONS.md`

## Files Affected

- Compiler's codegen module for WASM import generation
- Built-in function registry / bridge function map
- Any name → signature mapping tables
