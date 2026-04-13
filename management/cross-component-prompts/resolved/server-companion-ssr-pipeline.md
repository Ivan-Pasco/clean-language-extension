Component: clean-server
Issue Type: enhancement
Priority: medium
Description: Verify and test that the existing server architecture supports the companion file SSR pattern. The companion file pattern generates WASM handlers that call guard()/load() internally — the server should already support this with minimal or no changes.
Context: The framework spec and frame.ui plugin have been updated to implement the companion file pattern. The plugin generates page classes where render() calls guard() then load() before rendering HTML. The compiled WASM exports __route_handler_N() functions as before. The server should work as-is since it just calls handlers and returns their string results.

## What the Companion Pattern Does (Server Perspective)

From the server's perspective, nothing changes in the request flow:

1. HTTP request arrives
2. Server matches route to `__route_handler_N()`
3. Sets RequestContext in WASM store
4. Calls handler — handler internally:
   a. Calls `guard()` which may call `_res_redirect(302, "/login")`
   b. If guard redirected, returns `""` (empty string)
   c. Calls `load()` which uses `_req_param()`, `_db_query()` etc.
   d. Renders HTML template with data
   e. Returns HTML string
5. Server reads response:
   - If `pending_redirect` is set → return 302 redirect
   - Otherwise → return HTML body

## What Already Works

1. **Guard redirects**: `_res_redirect()` sets `pending_redirect` in WasmState (bridge.rs). After handler execution, `call_handler_with_auth()` reads `pending_redirect` and the server returns a 302 response. This flow already exists for API handlers.

2. **Empty string on redirect**: When guard() triggers a redirect, the handler returns `""`. The server checks `pending_redirect` before using the body, so an empty body is fine.

3. **Bridge functions**: All bridge functions used by companion files already exist:
   - `_req_param()`, `_req_param_int()` — path parameters
   - `_req_query()` — query parameters
   - `_req_header()` — headers
   - `_req_method()`, `_req_path()` — request info
   - `_auth_user_id()`, `_auth_require_auth()` — auth checks
   - `_db_query()`, `_db_execute()` — database access
   - `_res_redirect()` — redirect responses

4. **HTML content type**: Server auto-detects HTML responses by checking if body starts with `<` characters.

## Changes Needed (Minimal)

### 1. Verify redirect behavior

Ensure that when a WASM handler:
1. Calls `_res_redirect(302, "/login")`
2. Returns `""` (empty body)

The server correctly:
- Returns HTTP 302 status
- Sets Location header to "/login"
- Does NOT return the empty body as a 200

This should already work but needs an explicit test.

### 2. Add integration tests

Add tests for the companion file SSR flow:

```rust
#[tokio::test]
async fn test_guard_redirect() {
    // Load a WASM module where a route handler calls _res_redirect then returns ""
    // Verify the HTTP response is 302 with Location header
}

#[tokio::test]
async fn test_page_with_data() {
    // Load a WASM module where a route handler calls _req_param, _db_query,
    // then returns rendered HTML
    // Verify the HTML response contains interpolated data
}

#[tokio::test]
async fn test_static_page_no_companion() {
    // Load a WASM module where a route handler returns static HTML
    // Verify it works as before
}
```

### 3. Optional: Add page route metadata

Currently all routes are registered with `_http_route()` during WASM init. The companion pattern doesn't change this — page routes are still registered the same way. However, consider adding metadata so the server can distinguish page routes from API routes in logs/monitoring:

```rust
// Future enhancement — not required for basic functionality
enum RouteKind {
    Api,
    Page { has_guard: bool, has_load: bool },
}
```

## Files Affected

- `src/server.rs` — verify redirect handling after handler returns empty string
- `tests/` — add companion file flow integration tests
- No changes to bridge.rs, router.rs, or wasm.rs required

## Priority

Medium — the existing architecture already supports this pattern. The main work is verification and testing, not new functionality.
