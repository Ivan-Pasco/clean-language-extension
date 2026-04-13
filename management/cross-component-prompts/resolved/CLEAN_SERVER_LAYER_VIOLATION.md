# Cross-Component Issue: clean-server Layer Architecture Violation

**Component:** clean-server
**Issue Type:** architecture/bug
**Priority:** HIGH
**Date Discovered:** 2025-01-26
**Discovered While:** Auditing execution layer compliance across all components

---

## Problem Description

The clean-server `host-bridge` module contains **Layer 3 (Server Extensions) functions** that should NOT be in a portable host-bridge library.

According to `platform-architecture/EXECUTION_LAYERS.md`:
- **Layer 2 (host-bridge)**: Portable across ALL runtimes (CLI, browser, Node.js, embedded)
- **Layer 3 (Server Extensions)**: Server-only functions that require HTTP context

The `host-bridge` library is meant to be reusable across all runtime implementations, but it currently contains server-specific functions that make no sense in non-server contexts (e.g., CLI tools, browser, embedded systems).

---

## Specific Violations

### File: `host-bridge/src/wasm_linker/http_server.rs`

This file should NOT exist in host-bridge. It contains ~30 Layer 3 functions:

**HTTP Server Lifecycle:**
- `_http_listen`
- `_http_route`
- `_http_route_protected`

**Request Context:**
- `_req_param`, `_req_param_int`, `_req_query`
- `_req_body`, `_req_body_field`
- `_req_header`, `_req_headers`
- `_req_method`, `_req_path`
- `_req_cookie`, `_req_form`, `_req_ip`

**Response:**
- `_http_respond`
- `_res_set_header`, `_http_set_header`
- `_http_redirect`, `_res_redirect`
- `_http_set_cache`, `_http_no_cache`

**Session/Auth:**
- `_auth_get_session`
- `_auth_require_auth`, `_auth_require_role`
- `_auth_can`, `_auth_has_any_role`
- `_auth_user_id`, `_auth_user_role`

---

## Current Architecture (WRONG)

```
host-bridge/
├── src/
│   └── wasm_linker/
│       ├── console.rs      ✅ Layer 2 (correct)
│       ├── file_io.rs      ✅ Layer 2 (correct)
│       ├── http_client.rs  ✅ Layer 2 (correct)
│       ├── database.rs     ✅ Layer 2 (correct)
│       ├── crypto_funcs.rs ✅ Layer 2 (correct)
│       ├── math.rs         ✅ Layer 2 (correct)
│       ├── string_ops.rs   ✅ Layer 2 (correct)
│       ├── memory.rs       ✅ Layer 2 (correct)
│       └── http_server.rs  ❌ Layer 3 (WRONG LOCATION)
```

---

## Required Fix

### Option A: Move to clean-server Only (Recommended)

1. **Delete** `host-bridge/src/wasm_linker/http_server.rs`
2. **Remove** `http_server` module from `host-bridge/src/wasm_linker/mod.rs`
3. **Keep** the existing implementation in `clean-server/src/bridge.rs`
4. **Remove** any `register_http_server_functions()` export from host-bridge

### Option B: Keep Reference Implementation but Don't Export

1. **Move** `http_server.rs` to a `server_extensions/` subdirectory
2. **Mark as NOT exported** in `host-bridge/src/lib.rs`
3. **Document clearly** that these are reference implementations, not portable functions
4. **Update mod.rs** to not auto-register these functions

---

## Files to Modify

1. `host-bridge/src/wasm_linker/http_server.rs` - DELETE or MOVE
2. `host-bridge/src/wasm_linker/mod.rs` - Remove http_server module
3. `host-bridge/src/lib.rs` - Remove any http_server exports
4. `src/bridge.rs` - Ensure all Layer 3 functions are here (they already are)

---

## Verification After Fix

Run the following checks:

1. `host-bridge` should compile without any `_http_*`, `_req_*`, `_auth_*` server functions
2. `clean-server` should still work with all server functions from `src/bridge.rs`
3. A hypothetical CLI tool using only `host-bridge` should not have access to request context functions

---

## Reference

See `platform-architecture/EXECUTION_LAYERS.md` for the authoritative layer definitions.
