# Cross-Component Prompt: Update Node.js Server Host Functions

**Component:** clean-node-server
**Issue Type:** feature
**Priority:** high
**Created:** 2026-01-24
**Created By:** clean-framework (frame.httpserver plugin development)
**Status:** Completed
**Completed:** 2026-01-24

## Description

The `clean-node-server` already has most HTTP host functions implemented, but the `frame.httpserver` plugin generates code that calls a few functions that don't exist yet.

## Existing Functions (Already Implemented)

The Node.js server already has in `src/bridge/`:

**request.ts:**
- `_req_method()`, `_req_path()`
- `_req_param(name)` - Get route parameter as string ✓
- `_req_query(name)` - Get query parameter ✓
- `_req_body()` - Get full request body ✓
- `_req_json()` - Parse body as JSON ✓
- `_req_header(name)`, `_req_cookie(name)`

**http-server.ts:**
- `_http_listen(port)`
- `_http_set_status(status)`, `_http_set_header(name, value)`, `_http_set_body(body)`
- `_http_json(body)`, `_http_html(body)`, `_http_text(body)`
- `_http_redirect(status, url)`
- `_http_not_found()`, `_http_bad_request()`, `_http_unauthorized()`, `_http_forbidden()`

## Missing Functions (Need to Add)

### 1. `_req_body_field(field_name: string) -> string`

Extract a specific field from the JSON request body.

**Add to `src/bridge/request.ts`:**

```typescript
_req_body_field(namePtr: number, nameLen: number): number {
    const state = getState();
    const name = readString(state.memory, namePtr, nameLen);

    // Parse body as JSON and extract field
    const body = state.request?.body;
    if (!body) return writeString(state, '');

    try {
        const json = typeof body === 'string' ? JSON.parse(body) : body;
        const value = json[name];
        return writeString(state, value?.toString() ?? '');
    } catch {
        return writeString(state, '');
    }
}
```

**Usage in generated code:**
```clean
string email = _req_body_field("email")
string password = _req_body_field("password")
```

### 2. `_req_param_int(param_name: string) -> integer`

Get a route parameter as an integer.

**Add to `src/bridge/request.ts`:**

```typescript
_req_param_int(namePtr: number, nameLen: number): number {
    const state = getState();
    const name = readString(state.memory, namePtr, nameLen);

    const params = state.request?.params ?? {};
    const value = params[name];

    if (value === undefined) return 0;
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
}
```

**Usage in generated code:**
```clean
integer id = _req_param_int("id")
```

### 3. `_http_respond(status: integer, content_type: string, body: string) -> string`

Combined function to set status, content-type, and body in one call.

**Add to `src/bridge/http-server.ts`:**

```typescript
_http_respond(
    status: number,
    contentTypePtr: number,
    contentTypeLen: number,
    bodyPtr: number,
    bodyLen: number
): number {
    const state = getState();
    const contentType = readString(state.memory, contentTypePtr, contentTypeLen);
    const body = readString(state.memory, bodyPtr, bodyLen);

    state.response = {
        status,
        headers: { 'Content-Type': contentType },
        body
    };

    return writeString(state, body);
}
```

**Usage in generated code:**
```clean
return _http_respond(200, "application/json", "{\"success\":true}")
return _http_respond(400, "application/json", "{\"error\":\"Bad request\"}")
```

## Alternative Approach

Instead of adding `_http_respond`, the plugin could be updated to use the existing functions:

```clean
// Instead of:
return _http_respond(200, "application/json", data)

// Use:
_http_set_status(200)
_http_set_header("Content-Type", "application/json")
_http_set_body(data)
return data
```

However, the combined function is more convenient for the plugin to generate.

## Files to Modify

- `src/bridge/request.ts` - Add `_req_body_field` and `_req_param_int`
- `src/bridge/http-server.ts` - Add `_http_respond`
- `src/bridge/index.ts` - Export new functions

## Testing

Test with the Frame Framework's complete-demo:

```bash
cd clean-framework/examples/complete-demo
cln compile app/api/main.cln --output api.wasm
clean-node-server run api.wasm --port 3000
curl http://localhost:3000/api/health
```

## Priority

High - This is needed to run applications built with the `frame.httpserver` plugin.
