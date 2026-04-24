# Cross-Component Issue: Plugin Function Naming Alignment

**Component**: clean-framework
**Issue Type**: enhancement/standardization
**Priority**: medium
**Created**: 2026-01-26
**Source Component**: platform-architecture (SERVER_EXTENSIONS.md)

## Description

The `frame.httpserver` plugin declares bridge functions with naming conventions that differ from the official architecture specification in `/platform-architecture/SERVER_EXTENSIONS.md`. This creates confusion and potential compatibility issues.

## Naming Mismatches

| Plugin Declares | Architecture Specifies | Notes |
|-----------------|------------------------|-------|
| `_req_headers` | `_req_header` | Plugin returns ALL headers; architecture gets ONE by name |
| `_http_set_header` | `_res_set_header` | Different prefix (http vs res) |
| `_http_redirect` | `_res_redirect` | Different prefix (http vs res) |

## Plugin-Specific Functions (Not in Architecture)

These are declared by the plugin but not in the architecture spec:

| Function | Purpose | Should Add to Architecture? |
|----------|---------|----------------------------|
| `_req_headers` | Get all headers as JSON | Yes - useful complement to `_req_header` |
| `_req_form` | Parse form data | Yes - common web use case |
| `_req_ip` | Get client IP | Yes - needed for logging/security |
| `_json_encode` | JSON stringify | Should be in HOST_BRIDGE.md |
| `_json_decode` | JSON parse | Should be in HOST_BRIDGE.md |
| `_http_set_cache` | Cache-Control header | Could be `_res_set_cache` |
| `_http_no_cache` | Disable caching | Could be `_res_no_cache` |

## Recommended Actions

### Option A: Align Plugin to Architecture (Recommended)

Update `plugins/frame.httpserver/plugin.toml` to use architecture naming:

```toml
[bridge]
functions = [
    # HTTP Server (matches architecture)
    { name = "_http_route", params = ["string", "string", "integer"], returns = "integer" },
    { name = "_http_route_protected", params = ["string", "string", "integer", "string"], returns = "integer" },
    { name = "_http_listen", params = ["integer"], returns = "integer" },

    # Request Context (matches architecture)
    { name = "_req_param", params = ["string"], returns = "string" },
    { name = "_req_query", params = ["string"], returns = "string" },
    { name = "_req_body", params = [], returns = "string" },
    { name = "_req_header", params = ["string"], returns = "string" },  # Singular!
    { name = "_req_method", params = [], returns = "string" },
    { name = "_req_path", params = [], returns = "string" },
    { name = "_req_cookie", params = ["string"], returns = "string" },

    # Response Manipulation (matches architecture)
    { name = "_res_set_header", params = ["string", "string"], returns = "integer" },  # Changed prefix!
    { name = "_res_redirect", params = ["string", "integer"], returns = "integer" },    # Changed prefix!

    # Auth (matches architecture)
    { name = "_auth_get_session", params = [], returns = "string" },
    { name = "_auth_require_auth", params = [], returns = "integer" },
    { name = "_auth_require_role", params = ["string"], returns = "integer" },
    { name = "_auth_can", params = ["string"], returns = "integer" },
    { name = "_auth_has_any_role", params = ["string"], returns = "integer" },

    # Plugin Extensions (request to add to architecture)
    { name = "_req_headers", params = [], returns = "string", description = "Get ALL headers as JSON" },
    { name = "_req_form", params = [], returns = "string", description = "Parse form data" },
    { name = "_req_ip", params = [], returns = "string", description = "Get client IP" },
    { name = "_res_set_cache", params = ["integer"], returns = "integer" },  # Renamed
    { name = "_res_no_cache", params = [], returns = "integer" }              # Renamed
]
```

### Option B: Update Architecture to Include Plugin Functions

Add the plugin-specific functions to `/platform-architecture/SERVER_EXTENSIONS.md`:

1. `_req_headers` - Get all headers as JSON object
2. `_req_form` - Parse form-urlencoded body as JSON
3. `_req_ip` - Get client IP address
4. `_res_set_cache(seconds)` - Set Cache-Control max-age
5. `_res_no_cache()` - Set Cache-Control: no-cache

### Option C: Support Both (Aliases)

Have the server support both naming conventions:
- `_http_set_header` AND `_res_set_header` → same implementation
- This maintains backward compatibility but adds complexity

## JSON Functions

The JSON functions (`_json_encode`, `_json_decode`) should be moved to the portable HOST_BRIDGE specification since they're not server-specific:

In `/platform-architecture/HOST_BRIDGE.md`, add:

```markdown
## JSON Operations (2 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| `_json_encode` | `(ptr: i32, len: i32) -> i32` | Serialize value to JSON string |
| `_json_decode` | `(ptr: i32, len: i32) -> i32` | Parse JSON string to value |
```

## Files to Modify

In clean-framework:
- `plugins/frame.httpserver/plugin.toml` - Rename functions to match architecture

In platform-architecture (separate task):
- `SERVER_EXTENSIONS.md` - Add new plugin-specific functions
- `HOST_BRIDGE.md` - Add JSON functions

## Testing

After renaming:
1. Update all examples that use the old function names
2. Ensure compiler recognizes new names
3. Ensure server implements new names
4. Run full test suite

## Priority

**MEDIUM** - This is a standardization issue that should be resolved before v1.0 but doesn't block current development (the server fix is more urgent).
