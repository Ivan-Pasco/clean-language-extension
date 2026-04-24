# Clean Server — Architecture Review + Missing Bridge Functions Audit

Component: clean-server
Issue Type: architecture review + missing implementations
Priority: CRITICAL
Date: 2026-02-24
Source: Website migration to Frame standard structure revealed `endpoints:` plugin expansion blocked by missing host function

---

## Background

The Clean Language website has been migrated to the Frame standard directory structure (`app/api/`, `app/components/`, `app/data/`). The `endpoints:` syntax in `app/api/main.cln` compiles correctly through the parser but **fails at plugin expansion** because the frame.httpserver plugin WASM module requires `env::list.push_f64` which clean-server does not provide.

This is one symptom of a larger issue: clean-server may be missing multiple bridge functions that the compiler and plugins expect. The server should be comprehensively audited against the architecture documents.

---

## Immediate Blocker: `list.push_f64`

### Error
```
Plugin 'frame.httpserver' failed to expand 'endpoints:':
Failed to instantiate plugin module: unknown import: `env::list.push_f64` has not been defined
```

### WASM Signature
```
env::list.push_f64 = (i32, f64) -> (i32)
```
- `i32` param 1: list pointer (length-prefixed)
- `f64` param 2: float value to push
- `i32` return: updated list pointer

### Why It Matters
This blocks the `endpoints:` DSL syntax from frame.httpserver. Without it, every Frame app must use the legacy manual routing pattern (`start:` + `_http_route()` + `__route_handler_N()`) instead of the clean declarative syntax.

---

## Required: Full Architecture Review

**Read these documents thoroughly and audit clean-server against them:**

1. **`platform-architecture/EXECUTION_LAYERS.md`** — Defines which layer owns which functions
2. **`platform-architecture/HOST_BRIDGE.md`** — Specifies ALL Layer 2 portable functions (~100+)
3. **`platform-architecture/SERVER_EXTENSIONS.md`** — Specifies ALL Layer 3 server-only functions (~32)
4. **`platform-architecture/MEMORY_MODEL.md`** — WASM memory layout, string format
5. **`system-documents/ARCHITECTURE_BOUNDARIES.md`** — Component responsibilities

### What to Audit

For EVERY function listed in HOST_BRIDGE.md and SERVER_EXTENSIONS.md:

1. **Is it registered in clean-server's WASM linker?** (Check `src/bridge.rs` and `host-bridge/src/wasm_linker/*.rs`)
2. **Does the signature match what the compiler generates?** (Use the WASM import extraction script from `clean-server-comprehensive-signature-audit-and-fix.md`)
3. **Is the implementation functional or a stub?** (No dummy `return 0` implementations)
4. **Does it handle errors properly?** (Return empty string on error, not crash)

### Known Signature Mismatch Issue

There is an existing comprehensive prompt at:
```
Web Site Clean/system-documents/cross-component-prompts/clean-server-comprehensive-signature-audit-and-fix.md
```

This documents a **three-way disagreement** between:
- `function-registry.toml` (spec) — uses `"i32"` for Layer 3 strings
- `plugin.toml` files (compiler reads these) — uses `"string"` + `expand_strings = true`
- `bridge.rs` (server runtime) — was changed to match registry, breaking WASM compatibility

**The WASM binary is the contract.** The server MUST match what the compiler actually generates. The current compiled WASM signatures are documented in that prompt (lines 422-508).

---

## Specific Functions to Verify/Implement

### Category 1: Missing Functions (known)

| Function | Signature | Status | Impact |
|----------|-----------|--------|--------|
| `list.push_f64` | `(i32, f64) -> (i32)` | **MISSING** | Blocks plugin expansion |
| `_json_get` | `(i32, i32, i32, i32) -> (i32)` | **MISSING** | See `clean-server-json-get-feb2026.md` |

### Category 2: Functions from HOST_BRIDGE.md to Verify

**Console I/O** — Verify all 14 functions are registered and work:
- `print`, `printl`, `print_string`, `print_integer`, `print_float`, `print_boolean`
- `console_log`, `console_error`, `console_warn`
- `input`, `console_input`, `input_integer`, `input_float`, `input_yesno`, `input_range`

**Math** — Verify all 30+ math functions are registered:
- Trig: `math_sin`, `math_cos`, `math_tan`, `math_asin`, `math_acos`, `math_atan`, `math_atan2`
- Hyperbolic: `math_sinh`, `math_cosh`, `math_tanh`
- Log/Exp: `math_ln`, `math_log2`, `math_log10`, `math_exp`, `math_exp2`
- Power: `math_pow`, `math_sqrt`, `math_cbrt`
- Rounding: `math_floor`, `math_ceil`, `math_round`, `math_trunc`
- Other: `math_abs`, `math_min`, `math_max`, `math_random`

**String Operations** — Verify all 25+ string functions:
- `string.concat`, `string.split`, `string_compare`, `string_replace`
- `float_to_string`, `string_to_float`
- Others from HOST_BRIDGE.md

**Memory** — Verify 5 functions:
- `mem_alloc`, `mem_retain`, `mem_release`, `mem_scope_push`, `mem_scope_pop`

**Database** — Verify 5 functions:
- `_db_query`, `_db_execute`, `_db_begin`, `_db_commit`, `_db_rollback`

**File I/O** — Verify 5 functions:
- `file_read`, `file_write`, `file_exists`, `file_delete`, `file_append`

**HTTP Client** — Verify 20+ functions:
- `http_get`, `http_post`, `http_put`, `http_patch`, `http_delete`, `http_head`, `http_options`
- JSON variants: `http_post_json`, `http_put_json`, `http_patch_json`
- Helpers: `http_get_with_headers`, `http_post_with_headers`, `http_post_form`
- Config: `http_set_timeout`, `http_set_user_agent`, `http_set_max_redirects`, `http_enable_cookies`
- Utils: `http_build_query`, `http_encode_url`, `http_decode_url`, `http_get_response_code`, `http_get_response_headers`

**Crypto** — Verify 7 functions:
- `_crypto_hash_password`, `_crypto_verify_password`, `_crypto_random_bytes`
- `_crypto_sha256`, `_crypto_sha512`, `_crypto_hmac_sha256`, `_crypto_hmac_sha512`

**JWT** — Verify 3 functions:
- `_jwt_sign`, `_jwt_verify`, `_jwt_decode`

**Environment/Time** — Verify 2 functions:
- `_env_get`, `_time_now`

### Category 3: Functions from SERVER_EXTENSIONS.md to Verify

**HTTP Server** — 3 functions:
- `_http_listen`, `_http_route`, `_http_route_protected`

**Request Context** — 7 functions:
- `_req_param`, `_req_query`, `_req_body`, `_req_header`, `_req_method`, `_req_path`, `_req_cookie`

**Session Management** — 7 functions:
- `_session_store`, `_session_get`, `_session_delete`, `_session_exists`
- `_session_set_csrf`, `_session_get_csrf`, `_http_set_cookie`

**Role-Based Permissions** — 3 functions:
- `_roles_register`, `_role_has_permission`, `_role_get_permissions`

**Session Authentication** — 9 functions:
- `_auth_get_session`, `_auth_require_auth`, `_auth_require_role`
- `_auth_can`, `_auth_has_any_role`, `_auth_set_session`
- `_auth_clear_session`, `_auth_user_id`, `_auth_user_role`

**Response** — 2 functions:
- `_res_set_header`, `_res_redirect`

---

## Deliverables

1. **Implement `list.push_f64`** — Unblocks plugin expansion and `endpoints:` syntax
2. **Generate a compliance report** — For every function in HOST_BRIDGE.md and SERVER_EXTENSIONS.md:
   - Registered? (yes/no)
   - Signature matches WASM? (yes/mismatch/untested)
   - Implementation status? (working/stub/missing)
3. **Fix all signature mismatches** — Follow Phase 1 from the comprehensive audit prompt
4. **Implement any missing functions** that are specified in the architecture docs
5. **Add an integration test** that compiles a .cln file importing ALL bridge functions and verifies clean-server can instantiate it without errors

## Verification

After fixes:
```bash
# 1. Compile website with endpoints: syntax
cln compile --plugins -o dist/server.wasm app/api/main.cln

# 2. Start server — NO import errors
clean-server dist/server.wasm --port 3001 --database "mysql://..."

# 3. All routes respond
curl http://localhost:3001/api/health    # {"status":"ok"}
curl http://localhost:3001/              # HTML homepage

# 4. WASM signature verification
python3 wasm_imports.py dist/server.wasm  # All imports have matching server registrations
```

---

## Related Prompts
- `clean-server-comprehensive-signature-audit-and-fix.md` — Detailed signature mismatch analysis with WASM extraction script
- `clean-server-json-get-feb2026.md` — Missing `_json_get` function spec
- `clean-server-missing-list-push-f64.md` — Original `list.push_f64` report
- `clean-server-function-alignment.md` — Earlier alignment issues
- `clean-server-db-execute-return-type.md` — `_db_execute` return type issue
- `clean-server-str-replace.md` — `string_replace` implementation issue
