# Cross-Component Prompt: Implement HTTP Server Host Functions

**Component:** clean-server (or clean-node-server)
**Issue Type:** feature
**Priority:** high
**Created:** 2026-01-24
**Created By:** clean-framework (frame.httpserver plugin development)
**Status:** Completed
**Completed:** 2026-01-24

## Implementation Summary

Implemented in clean-server with the following additions:

### host-bridge changes:
- Added `HttpResponseBuilder` struct and HTTP server trait methods to `WasmStateCore`
- Created `http_server.rs` module with reference implementation (opt-in via `register_http_server_functions()`)

### bridge.rs additions:
- `_req_body_field` - Extract field from JSON body
- `_req_param_int` - Get path parameter as integer
- `_http_respond` - Send HTTP response (status + content-type + body)
- `_http_redirect` - Send redirect response
- `_http_set_header` - Set response header
- `_auth_user_id` - Get current user ID
- `_auth_user_role` - Get current user role

### wasm.rs additions:
- `pending_status` and `pending_body` fields
- `set_status()`, `set_body()`, `take_pending_status()` methods
- Updated `HandlerResponse` with `status` field

---

## Description

The `frame.httpserver` plugin generates code that calls host functions for HTTP request/response handling. These functions need to be implemented in the **server runtime** (not the compiler) as part of the Host Bridge.

The server runtime executes the compiled WASM application and must provide these host functions to handle actual HTTP requests and responses.

## Required Host Functions

### 1. `_req_body_field(field_name: string) -> string`

Extract a field from the JSON request body.

```clean
// Usage in generated code:
string email = _req_body_field("email")
string password = _req_body_field("password")
```

**Implementation notes:**
- Parse the request body as JSON
- Return the value of the specified field as a string
- Return empty string if field doesn't exist
- The request body should be available from the HTTP context

### 2. `_req_param(param_name: string) -> string`

Get a route parameter value as a string.

```clean
// For route: GET "/api/users/:id"
// Usage in generated code:
string id = _req_param("id")
```

**Implementation notes:**
- Route parameters are extracted from the URL path
- Parameters are defined with `:paramName` syntax in routes
- Return empty string if parameter doesn't exist

### 3. `_req_param_int(param_name: string) -> integer`

Get a route parameter value as an integer.

```clean
// For route: GET "/api/users/:id"
// Usage in generated code:
integer id = _req_param_int("id")
```

**Implementation notes:**
- Same as `_req_param` but parses the value as integer
- Return 0 if parameter doesn't exist or isn't a valid integer

### 4. `_req_query(param_name: string) -> string`

Get a query string parameter value.

```clean
// For URL: /api/users?page=2&limit=10
// Usage:
string page = _req_query("page")
```

### 5. `_http_respond(status: integer, content_type: string, body: string) -> string`

Send an HTTP response.

```clean
// Usage in generated code:
return _http_respond(200, "application/json", "{\"success\":true}")
return _http_respond(400, "application/json", "{\"error\":\"Bad request\"}")
return _http_respond(200, "text/html", "<h1>Hello</h1>")
```

**Implementation notes:**
- Set the HTTP status code
- Set the Content-Type header
- Write the body to the response
- Return the body (for chaining/logging purposes)

### 6. `_http_redirect(status: integer, url: string) -> string`

Send an HTTP redirect response.

```clean
// Usage:
return _http_redirect(302, "/login")
return _http_redirect(301, "https://newsite.com")
```

### 7. `_http_set_header(name: string, value: string) -> string`

Set a custom HTTP response header.

```clean
// Usage:
_http_set_header("X-Custom-Header", "value")
_http_set_header("Cache-Control", "no-cache")
```

### 8. `_http_listen(port: integer) -> integer`

Start the HTTP server on the specified port.

```clean
// Usage in generated code:
_http_listen(3000)
```

## HTTP Context

These functions need access to an HTTP context that contains:
- The current request (method, path, headers, body, query params)
- The response being built (status, headers, body)
- Route parameters extracted from path matching

This context should be:
1. Set up before calling the handler function
2. Accessible from host functions
3. Used to build the final HTTP response

## Files to Modify

For **clean-server** (Rust):
- `src/runtime/wasm_host.rs` - Add host function implementations
- `src/http/context.rs` - HTTP request/response context
- `src/http/router.rs` - Route matching and parameter extraction

For **clean-node-server** (Node.js):
- `src/runtime/host-functions.js` - Add host function implementations
- `src/http/context.js` - HTTP request/response context

## Example Generated Code

The plugin generates code like this:

```clean
functions:
	string jsonResponse(any data)
		return _http_respond(200, "application/json", data.toString())

	string badRequest(string message)
		return _http_respond(400, "application/json", message)

	string handler_0()
		string email = _req_body_field("email")
		string password = _req_body_field("password")
		if not (email == "")
			return jsonResponse("{\"success\":true}")
		return badRequest("Email required")

start()
	_http_listen(3000)
```

## Testing

Create a test in `tests/plugin_http_test.rs`:

```rust
#[test]
fn test_http_host_functions() {
    // Set up mock HTTP context
    // Call handler function
    // Verify response
}
```

## Priority

This is blocking the Frame Framework's HTTP server functionality. The plugin syntax is complete but the runtime support is missing.
