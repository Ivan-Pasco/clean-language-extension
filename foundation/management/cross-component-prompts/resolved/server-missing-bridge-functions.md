# Cross-Component Issue: Server Missing Bridge Functions

**Component**: clean-server
**Issue Type**: bug/compatibility
**Priority**: critical
**Created**: 2026-01-26
**Source Component**: clean-framework (frame.httpserver plugin)

## Description

The `clean-server` runtime fails to instantiate WASM modules compiled with the `frame.httpserver` plugin because it doesn't implement all the bridge functions declared in the plugin's `plugin.toml`.

## Error Message

```
WASM error: Failed to instantiate WASM module: unknown import: `env::_req_headers` has not been defined
```

## Architecture Reference

Review `/platform-architecture/SERVER_EXTENSIONS.md` which specifies all HTTP server functions that should be implemented.

### Functions Specified in Architecture

**Request Context (7 functions):**
- `_req_param` - Get path parameter by name
- `_req_query` - Get query parameter by name
- `_req_body` - Get request body
- `_req_header` - Get single header by name (case-insensitive)
- `_req_method` - Get HTTP method
- `_req_path` - Get request path
- `_req_cookie` - Get cookie by name

**Session Authentication (5 functions):**
- `_auth_get_session` - Get current session info (JSON)
- `_auth_require_auth` - Check if authenticated (returns 0/1)
- `_auth_require_role` - Check if user has role (returns 0/1)
- `_auth_can` - Check permission (returns 0/1)
- `_auth_has_any_role` - Check multiple roles (returns 0/1)

**Response Manipulation (2 functions):**
- `_res_set_header` - Set response header
- `_res_redirect` - Send HTTP redirect

**HTTP Server (3 functions):**
- `_http_listen` - Configure server port
- `_http_route` - Register route handler
- `_http_route_protected` - Register protected route

### Functions Declared by Plugin (may have naming differences)

The `frame.httpserver` plugin declares these additional functions that may need implementation:

```toml
{ name = "_req_headers", params = [], returns = "string" }  # All headers as JSON
{ name = "_req_form", params = [], returns = "string" }     # Form data as JSON
{ name = "_req_ip", params = [], returns = "string" }       # Client IP address
{ name = "_http_redirect", params = ["integer", "string"], returns = "string" }
{ name = "_http_set_header", params = ["string", "string"], returns = "string" }
{ name = "_json_encode", params = ["any"], returns = "string" }
{ name = "_json_decode", params = ["string"], returns = "any" }
{ name = "_http_set_cache", params = ["integer"], returns = "integer" }
{ name = "_http_no_cache", params = [], returns = "integer" }
```

**Note**: Some naming mismatches between plugin and architecture:
- Plugin: `_req_headers` (all) vs Architecture: `_req_header` (single)
- Plugin: `_http_set_header` vs Architecture: `_res_set_header`
- Plugin: `_http_redirect` vs Architecture: `_res_redirect`

## Implementation Steps

1. **Audit current implementation**: Check which functions are already implemented in clean-server

2. **Implement missing architecture functions**: All functions from SERVER_EXTENSIONS.md

3. **Implement plugin-specific functions**: Add any additional functions the plugin needs:
   - `_req_headers` - Return all headers as JSON object
   - `_req_form` - Parse form-urlencoded body
   - `_req_ip` - Get client IP from connection
   - `_http_set_cache` / `_http_no_cache` - Cache-Control headers

4. **Support naming aliases**: Consider supporting both naming conventions for compatibility

### Example Implementations

```rust
// _req_headers - Get all headers as JSON
fn req_headers(&self) -> String {
    let headers = self.current_request.headers();
    let mut map = serde_json::Map::new();
    for (key, value) in headers.iter() {
        map.insert(
            key.as_str().to_string(),
            serde_json::Value::String(value.to_str().unwrap_or("").to_string())
        );
    }
    serde_json::to_string(&map).unwrap_or("{}".to_string())
}

// _req_form - Parse form data
fn req_form(&self) -> String {
    let body = self.current_request.body();
    // Parse application/x-www-form-urlencoded
    let params: HashMap<String, String> = url::form_urlencoded::parse(body.as_bytes())
        .into_owned()
        .collect();
    serde_json::to_string(&params).unwrap_or("{}".to_string())
}

// _req_ip - Get client IP
fn req_ip(&self) -> String {
    // Check X-Forwarded-For, X-Real-IP, then connection IP
    self.current_request.client_ip().to_string()
}
```

## Files to Modify

In clean-server repository:
- `src/bridge/http.rs` - HTTP request/response functions
- `src/bridge/auth.rs` - Authentication functions
- `src/wasm/imports.rs` - Register all imports with WASM runtime

## Testing

After implementing:
```bash
# 1. Compile a test file with the plugin
cd /Users/earcandy/Documents/Dev/Clean\ Language/clean-framework
cln compile /tmp/minimal-api.cln -o /tmp/minimal-api.wasm

# 2. Run with server
cleen server run /tmp/minimal-api.wasm --port 3000

# 3. Should start without import errors
# 4. Test endpoints work
curl http://localhost:3000/
```

## Priority

This is **CRITICAL** because no plugin-based code can run on clean-server until this is fixed.
