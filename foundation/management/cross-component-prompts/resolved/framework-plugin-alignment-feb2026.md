Component: clean-framework
Issue Type: compatibility
Priority: critical
Description: |
  The clean-server host bridge has been updated to align with framework plugin declarations.
  This prompt documents what was implemented and what the framework still needs to verify/update
  in its plugin.toml files to ensure full alignment.

Context: |
  This is the resolution of the host-bridge-plugin-function-alignment audit (Categories 1-5).
  The clean-server has been updated to match the frame.auth plugin's naming conventions for crypto,
  JWT, session, and role functions. Some plugin declarations may still need updates.

## What clean-server now implements

### Category 2 RESOLVED: frame.auth Name Mismatches (all fixed)

The server now uses the plugin-declared names:

| Plugin Declares | Server Now Registers | Status |
|-----------------|---------------------|--------|
| `_crypto_hash_password` | `_crypto_hash_password` | ALIGNED |
| `_crypto_verify_password` | `_crypto_verify_password` | ALIGNED |
| `_crypto_hash_sha256` | `_crypto_hash_sha256` | ALIGNED |
| `_crypto_random_bytes` | `_crypto_random_bytes` | ALIGNED |
| `_session_delete(string)` | `_session_delete(string)` | ALIGNED |
| `_session_get(string)` | `_session_get(string)` | ALIGNED |
| `_session_store(string, string)` | `_session_store(string, string)` | ALIGNED |
| `_http_set_cookie(string, string, string)` | `_http_set_cookie(string, string, string)` | ALIGNED |

### Category 3 RESOLVED: Missing functions (all implemented)

| Function | Status |
|----------|--------|
| `_env_get(string) -> string` | IMPLEMENTED |
| `_time_now() -> integer` | IMPLEMENTED (returns i64) |
| `_crypto_random_hex(integer) -> string` | IMPLEMENTED |
| `_crypto_hash_sha512(string) -> string` | IMPLEMENTED |
| `_crypto_hmac(string, string, string) -> string` | IMPLEMENTED |
| `_jwt_sign(string, string, string) -> string` | IMPLEMENTED |
| `_jwt_verify(string, string, string) -> string` | IMPLEMENTED |
| `_jwt_decode(string) -> string` | IMPLEMENTED |
| `_session_exists(string) -> integer` | IMPLEMENTED |
| `_session_set_csrf(string) -> integer` | IMPLEMENTED |
| `_session_get_csrf() -> string` | IMPLEMENTED |
| `_roles_register(string) -> integer` | IMPLEMENTED |
| `_role_has_permission(string, string) -> boolean` | IMPLEMENTED |
| `_role_get_permissions(string) -> string` | IMPLEMENTED |

### Category 4: frame.data Transaction Functions

The server already implements these but frame.data plugin.toml needs to declare them:

```toml
_db_begin = { params = [], returns = "integer" }
_db_commit = { params = [], returns = "integer" }
_db_rollback = { params = [], returns = "integer" }
```

### Category 1: HTTP Client Plugin

The server implements 22 HTTP client functions but NO plugin declares them.
Recommended: Create a new `frame.httpclient` plugin or add to `frame.httpserver`.

HTTP client functions available:
- `http_get`, `http_post`, `http_put`, `http_patch`, `http_delete`, `http_head`, `http_options`
- `http_post_json`, `http_put_json`, `http_patch_json`
- `http_post_form`
- `http_get_with_headers`, `http_post_with_headers`
- `http_set_user_agent`, `http_set_timeout`, `http_set_max_redirects`
- `http_enable_cookies`, `http_get_response_code`, `http_get_response_headers`
- `http_encode_url`, `http_decode_url`, `http_build_query`

## Suggested Actions for Framework

1. **Verify frame.auth plugin.toml** matches the server's registered function names (should already be correct since the server was aligned to the plugin)
2. **Add DB transaction functions** to frame.data plugin.toml (`_db_begin`, `_db_commit`, `_db_rollback`)
3. **Create HTTP client plugin** (or add to existing plugin) for the 22 HTTP client functions
4. **Verify frame.httpserver** includes `_auth_set_session`, `_auth_clear_session`, `_auth_user_id`, `_auth_user_role` (these are implemented in the server)

## Authoritative Reference

- Host Bridge docs: `../platform-architecture/HOST_BRIDGE.md`
- Server Extensions docs: `../platform-architecture/SERVER_EXTENSIONS.md`
- WAT spec: `clean-server/host-bridge/tests/spec_compliance.wat`

## Files Affected

- `plugins/frame.auth/plugin.toml` - Verify alignment
- `plugins/frame.data/plugin.toml` - Add transaction functions
- `plugins/frame.httpserver/plugin.toml` - Add missing auth functions
- New plugin for HTTP client functions (optional)
