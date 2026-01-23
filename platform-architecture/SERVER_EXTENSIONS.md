# Server Extensions

This document describes the server-specific host functions that extend the portable host-bridge for HTTP server functionality.

## Overview

Server extensions are functions that require HTTP server context and are NOT portable across all hosts. These functions are implemented separately in each server runtime (Rust clean-server, Node.js, Go, etc.).

## HTTP Server Functions (3 functions)

### `_http_listen`

Configure the HTTP server port.

```
Signature: (port: i32) -> void
Module: env
```

**Example (Clean Language):**
```clean
http.listen(3000)
```

**Implementation Notes:**
- Called during module initialization
- Sets the port for the HTTP server
- Does not actually start listening (that happens after init)

---

### `_http_route`

Register a route handler.

```
Signature: (method_ptr: i32, method_len: i32, path_ptr: i32, path_len: i32, handler_idx: i32) -> void
Module: env
```

**Parameters:**
- `method`: HTTP method string ("GET", "POST", "PUT", "DELETE", etc.)
- `path`: Route path with optional parameters ("/users/:id", "/api/items")
- `handler_idx`: WASM function table index for the handler

**Example (Clean Language):**
```clean
http.get("/users/:id", handler_func)
```

**Path Parameters:**
- `:name` - captures a segment (e.g., `/users/:id` matches `/users/123`)
- `*` - wildcard (implementation specific)

---

### `_http_route_protected`

Register a protected route requiring authentication.

```
Signature: (method_ptr: i32, method_len: i32, path_ptr: i32, path_len: i32, handler_idx: i32, role_ptr: i32, role_len: i32) -> void
Module: env
```

**Parameters:**
- Same as `_http_route` plus:
- `role`: Required role (or empty string for any authenticated user)

**Example (Clean Language):**
```clean
http.get_protected("/admin/dashboard", handler_func, "admin")
```

---

## Request Context Functions (7 functions)

These functions access the current HTTP request during handler execution.

### `_req_param`

Get a path parameter by name.

```
Signature: (name_ptr: i32, name_len: i32) -> i32
Returns: Pointer to string value (empty if not found)
```

**Example:**
```clean
// Route: /users/:id
let user_id = request.param("id")  // "123" for /users/123
```

---

### `_req_query`

Get a query parameter by name.

```
Signature: (name_ptr: i32, name_len: i32) -> i32
Returns: Pointer to string value (empty if not found)
```

**Example:**
```clean
// URL: /users?page=2&limit=10
let page = request.query("page")  // "2"
let limit = request.query("limit")  // "10"
```

---

### `_req_body`

Get the request body as a string.

```
Signature: () -> i32
Returns: Pointer to body string
```

**Example:**
```clean
let body = request.body()
let data = json.parse(body)
```

---

### `_req_header`

Get a request header by name (case-insensitive).

```
Signature: (name_ptr: i32, name_len: i32) -> i32
Returns: Pointer to header value (empty if not found)
```

**Example:**
```clean
let content_type = request.header("Content-Type")
let auth = request.header("authorization")  // case-insensitive
```

---

### `_req_method`

Get the HTTP method.

```
Signature: () -> i32
Returns: Pointer to method string ("GET", "POST", etc.)
```

---

### `_req_path`

Get the request path (without query string).

```
Signature: () -> i32
Returns: Pointer to path string
```

---

### `_req_cookie`

Get a cookie value by name.

```
Signature: (name_ptr: i32, name_len: i32) -> i32
Returns: Pointer to cookie value (empty if not found)
```

**Example (Clean Language):**
```clean
let session_id = request.cookie("session")
let user_pref = request.cookie("theme")  // "dark" or "light"
```

**Notes:**
- Cookie names are case-sensitive
- Returns empty string if cookie not found
- Parses cookies from the `Cookie` header

---

## Session Authentication Functions (5 functions)

These functions manage session-based authentication.

### `_auth_get_session`

Get the current session information.

```
Signature: () -> i32
Returns: Pointer to JSON string or "null"
```

**Response Format:**
```json
{
  "user_id": 123,
  "role": "admin",
  "session_id": "abc123..."
}
```

---

### `_auth_require_auth`

Check if the current request is authenticated.

```
Signature: () -> i32
Returns: 1 if authenticated, 0 if not
```

---

### `_auth_require_role`

Check if the user has a specific role.

```
Signature: (role_ptr: i32, role_len: i32) -> i32
Returns: 1 if user has role, 0 if not
```

---

### `_auth_can`

Check if the user has a permission (role-based).

```
Signature: (permission_ptr: i32, permission_len: i32) -> i32
Returns: 1 if permitted, 0 if not
```

**Notes:**
- "admin" role has all permissions
- Otherwise checks if role matches permission

---

### `_auth_has_any_role`

Check if the user has any of the specified roles.

```
Signature: (roles_ptr: i32, roles_len: i32) -> i32
Returns: 1 if user has any role, 0 if not
```

**Parameter Format:**
```json
["admin", "editor", "moderator"]
```

---

## Response Manipulation Functions (2 functions)

These functions allow handlers to control HTTP response headers and redirects.

### `_res_set_header`

Set a custom response header.

```
Signature: (name_ptr: i32, name_len: i32, value_ptr: i32, value_len: i32) -> i32
Returns: 1 on success, 0 on error
```

**Example (Clean Language):**
```clean
// Set CORS headers
response.setHeader("Access-Control-Allow-Origin", "*")
response.setHeader("Cache-Control", "max-age=3600")
```

**Common Use Cases:**
- CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`)
- Cache control (`Cache-Control`, `ETag`, `Expires`)
- Security headers (`X-Frame-Options`, `Content-Security-Policy`)
- Custom content types (`Content-Type`)

---

### `_res_redirect`

Send an HTTP redirect response.

```
Signature: (url_ptr: i32, url_len: i32, status_code: i32) -> i32
Returns: 1 on success, 0 on error
```

**Status Codes:**
- `301` - Moved Permanently (cacheable, may change method to GET)
- `302` - Found (temporary, may change method to GET)
- `303` - See Other (always use GET for redirect)
- `307` - Temporary Redirect (preserves HTTP method)
- `308` - Permanent Redirect (preserves HTTP method)

**Example (Clean Language):**
```clean
// After successful login, redirect to dashboard
response.redirect("/dashboard", 302)

// Permanent redirect for SEO
response.redirect("/new-page", 301)

// Preserve POST method after form processing
response.redirect("/result", 307)
```

**Notes:**
- When a redirect is set, the handler's return value (body) is ignored
- Cookies set via `_session_create` are still included in redirect responses
- Custom headers set via `_res_set_header` are also included

---

## Handler Function Signature

Route handlers are WASM functions with this signature:

```
Handler: () -> i32
Returns: Pointer to response string (typically JSON)
```

The compiler generates wrapper functions:
```
__route_handler_0, __route_handler_1, ...
```

**Example Handler (Clean Language):**
```clean
func get_user() -> string {
    let id = request.param("id")
    let user = db.query("SELECT * FROM users WHERE id = ?", [id])
    return json.stringify(user[0])
}

http.get("/users/:id", get_user)
```

---

## Request/Response Flow

```
1. HTTP Request arrives
   │
2. Server creates RequestContext
   │  - method, path, headers, body
   │  - parsed params, query
   │
3. Route matcher finds handler
   │  - Checks if protected
   │  - Validates authentication
   │  - Checks role requirements
   │
4. Create fresh WASM instance (or reset memory)
   │
5. Set request context in WasmState
   │
6. Call handler function by index
   │
7. Handler accesses request via _req_* functions
   │
8. Handler returns response string pointer
   │
9. Server reads response from WASM memory
   │
10. Send HTTP response to client
```

---

## Implementation in Different Runtimes

### Rust (clean-server)

```rust
impl WasmStateCore for WasmState {
    fn memory(&self) -> &WasmMemory { &self.memory }
    fn memory_mut(&mut self) -> &mut WasmMemory { &mut self.memory }
}

// Server-specific state
pub struct WasmState {
    pub memory: WasmMemory,
    pub request_context: Option<RequestContext>,
    pub auth_context: Option<AuthContext>,
    // ...
}
```

### Node.js (future)

```javascript
const imports = {
  env: {
    // Portable functions from host-bridge spec
    print: (ptr, len) => { /* ... */ },

    // Server-specific functions
    _req_param: (name_ptr, name_len) => {
      const name = readString(memory, name_ptr, name_len);
      return writeString(memory, currentRequest.params[name] || "");
    },
    // ...
  }
};
```

### Go (future)

```go
type WasmState struct {
    Memory        *WasmMemory
    RequestContext *RequestContext
    AuthContext   *AuthContext
}

func reqParam(caller *wasmtime.Caller, namePtr, nameLen int32) int32 {
    name := readString(caller, namePtr, nameLen)
    value := state.RequestContext.Params[name]
    return writeString(caller, value)
}
```
