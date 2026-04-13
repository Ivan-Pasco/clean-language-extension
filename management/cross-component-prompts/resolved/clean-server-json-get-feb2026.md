# Cross-Component Prompt: Add `_json_get` Host Bridge Function to clean-server

**Component:** clean-server
**Issue Type:** feature
**Priority:** high
**Created:** 2026-02-14
**Source Component:** clean-framework (frame.auth plugin declares it, website needs it)
**Status:** Pending

---

## Summary

The clean-server (Rust runtime) is missing the `_json_get(json_string, path)` host bridge function. This function is already:
- **Declared** in `clean-framework/plugins/frame.auth/plugin.toml` as a bridge function
- **Implemented** in `clean-node-server/src/bridge/http-server.ts` (working reference)
- **NOT implemented** in `clean-server/src/bridge.rs`

The clean-server has `_json_encode` and `_json_decode` (lines ~1103-1165 in `src/bridge.rs`) but not `_json_get`. Any WASM module compiled with `_json_get` imports will fail to instantiate on the Rust server.

---

## Function Specification

```
_json_get(json_string: string, path: string) -> string
```

**WASM Signature:**
```
(json_ptr: i32, json_len: i32, path_ptr: i32, path_len: i32) -> i32
```

**Behavior:**
- Parse `json_string` as JSON using `serde_json`
- Walk the dot-separated `path` (e.g., `"user.email"`, `"claims.role"`)
- Return the value as a string:
  - String values: return as-is (without quotes)
  - Numbers/booleans: return `.to_string()`
  - Null or not found: return empty string `""`
  - Objects/arrays: return JSON-serialized string
- On parse error: return empty string `""`

---

## Reference Implementation (Node Server)

From `clean-node-server/src/bridge/http-server.ts`:

```typescript
_json_get(jsonPtr, jsonLen, pathPtr, pathLen): number {
    const jsonStr = readString(state, jsonPtr, jsonLen);
    const path = readString(state, pathPtr, pathLen);

    try {
        const parsed = JSON.parse(jsonStr);
        const parts = path.split('.');
        let current = parsed;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return writeString(state, '');
            }
            if (typeof current === 'object' && current !== null) {
                current = current[part];
            } else {
                return writeString(state, '');
            }
        }

        if (current === null || current === undefined) {
            return writeString(state, '');
        }
        if (typeof current === 'string') {
            return writeString(state, current);
        }
        return writeString(state, JSON.stringify(current));
    } catch {
        return writeString(state, '');
    }
}
```

---

## Suggested Rust Implementation

Add after `_json_decode` in `src/bridge.rs` (around line 1165):

```rust
// _json_get - Extract value from JSON by dot-path
linker
    .func_wrap(
        "env",
        "_json_get",
        |mut caller: Caller<'_, WasmState>, json_ptr: i32, json_len: i32, path_ptr: i32, path_len: i32| -> i32 {
            let json_str = match read_raw_string(&mut caller, json_ptr, json_len) {
                Some(s) => s,
                None => return write_string_to_caller(&mut caller, ""),
            };
            let path = match read_raw_string(&mut caller, path_ptr, path_len) {
                Some(s) => s,
                None => return write_string_to_caller(&mut caller, ""),
            };

            let parsed: serde_json::Value = match serde_json::from_str(&json_str) {
                Ok(v) => v,
                Err(_) => return write_string_to_caller(&mut caller, ""),
            };

            let mut current = &parsed;
            for part in path.split('.') {
                match current.get(part) {
                    Some(v) => current = v,
                    None => return write_string_to_caller(&mut caller, ""),
                }
            }

            let result = match current {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Null => String::new(),
                other => other.to_string(),
            };

            debug!("_json_get: path='{}' -> '{}'", path, result);
            write_string_to_caller(&mut caller, &result)
        },
    )
    .map_err(|e| RuntimeError::wasm(format!("Failed to define _json_get: {}", e)))?;
```

---

## Files to Modify

| Action | File | Description |
|--------|------|-------------|
| **MODIFY** | `src/bridge.rs` | Add `_json_get` function after `_json_decode` (~line 1165) |

---

## Testing

```clean
// Test file: test_json_get.cln
start:
    string json = "{\"user\": {\"name\": \"Alice\", \"email\": \"alice@test.com\"}, \"count\": 42}"
    string name = _json_get(json, "user.name")     // Expected: "Alice"
    string email = _json_get(json, "user.email")    // Expected: "alice@test.com"
    string count = _json_get(json, "count")         // Expected: "42"
    string missing = _json_get(json, "user.phone")  // Expected: ""
    string bad = _json_get("not json", "key")       // Expected: ""
    printl(name)
    printl(email)
    printl(count)
```

---

## Context

The Website team discovered this gap when building article pages. Their manual `json_get` function using `.indexOf()` and `.substring()` broke on null values, escaped quotes, and nested objects. A native host bridge function using `serde_json` eliminates all these edge cases.
