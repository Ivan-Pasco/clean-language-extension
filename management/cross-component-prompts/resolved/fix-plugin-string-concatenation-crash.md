# Cross-Component Prompt: Fix Plugin String Concatenation Crash

**Component:** clean-language-compiler
**Issue Type:** bug
**Priority:** medium
**Created:** 2026-01-24
**Created By:** clean-framework (frame.httpserver plugin development)
**Status:** ✅ FIXED in v0.30.7

## Analysis

### Initial Misdiagnosis (v0.30.5 - REVERTED)
Initially thought to be caused by missing underscore-style function aliases. However, Clean Language uses camelCase/dot notation (`string.concat`, `string.startsWith`), not underscore style. The WASM imports confirmed this - all string functions use dot notation. The v0.30.5 underscore aliases were never called and were reverted in v0.30.6.

### Actual Root Cause (v0.30.7 - FIXED)
The real issue was **memory management in plugin host functions**:

1. **Bump allocator overflow**: The plugin's bump allocator (starting at 512KB) could allocate beyond WASM memory bounds without checking
2. **Silent write failures**: All `memory.write()` calls used `let _ = memory.write(...)` which discards the Result, causing silent failures when memory is too small
3. **No memory growth**: Unlike other runtime code, plugin host functions never grew WASM memory when needed

**Fix Applied (v0.30.7):**
Added proper memory handling to critical string functions in `src/plugins/wasm_adapter.rs`:
- `string.concat`: Added memory growth check before write
- `string.substring`: Added memory growth check before write
- `string_replace`: Added memory growth check before write

Pattern applied to each function:
1. Calculate total allocation size
2. Check if current memory is large enough
3. Grow memory if needed (in 64KB WASM pages)
4. Handle write errors properly instead of discarding them

**Recommended Action:** Retest the frame.httpserver plugin with Clean Language v0.30.7 to verify JSON building works correctly.

---

## Description

Complex string concatenation operations in plugins cause WASM crashes or memory corruption. This prevents the `frame.httpserver` plugin from building JSON object literals dynamically.

## Context

The plugin needs to transform DSL syntax like:

```clean
return json:
    success: true
    message: "Hello World"
    count: 42
```

Into:

```clean
return jsonResponse("{\"success\":true,\"message\":\"Hello World\",\"count\":42}")
```

This requires:
1. Parsing each property line
2. Building escaped JSON property strings
3. Concatenating all properties into a final JSON string

## Reproduction Steps

1. In a plugin, attempt to build a JSON string with multiple properties:

```clean
string build_json_property(string line)
    integer colon = line.indexOf(" : ")
    string key = line.substring(0, colon)
    string value = line.substring(colon + 3, line.length())

    // Build escaped property
    string prop = "\\\"" + key + "\\\":"

    if value == "true"
        return prop + "true"
    if value.startsWith("\"")
        string inner = value.substring(1, value.length() - 1)
        return prop + "\\\"" + inner + "\\\""

    return prop + value

// Then concatenate multiple properties:
string json_props = ""
json_props = json_props + build_json_property("success : true")
json_props = json_props + "," + build_json_property("message : \"Hello\"")
json_props = json_props + "," + build_json_property("count : 42")

string result = "{" + json_props + "}"
```

2. The plugin crashes with a WASM backtrace:

```
error while executing at wasm backtrace:
    0: 0x65b8 - <unknown>!<wasm function 353>
    1: 0x56f5 - <unknown>!<wasm function 348>
    ...
```

3. Or produces corrupted output with spaces/garbage characters:

```
[Plugin Debug] string.replace called: source='{\"
                                              \":"
                                              ",\"
```

## Observed Behavior

1. **Simple concatenations work**: `"hello" + " " + "world"` ✓
2. **Escape sequences work**: `"\\\"key\\\""` ✓
3. **Multiple concatenations with escapes crash**: Building JSON properties in a loop crashes

## Suspected Cause

The issue appears to be in how the plugin runtime handles:
- String memory allocation for concatenation results
- Escape sequence processing in string literals
- Multiple levels of string building (function returns + concatenation)

Related to the previously fixed `trim()` corruption issue (see `fix-plugin-string-corruption.md`).

Possible locations:
- `src/plugins/wasm_adapter.rs` - String host functions
- `src/codegen/` - String literal encoding for WASM
- Memory management in plugin execution context

## Current Workaround

The plugin outputs a placeholder `{}` instead of the actual JSON:

```clean
// In transform_handler:
if transformed.startsWith("return json :")
    transformed = "return jsonResponse(\"{}\")"
    // TODO: Parse object properties when compiler string handling is stable
```

This means the DSL syntax is parsed correctly, but the JSON content is lost.

## Test Case

Create a test in `tests/plugin_string_test.rs`:

```rust
#[test]
fn test_complex_string_concatenation() {
    let plugin_code = r#"
functions:
    string build_prop(string key, string val)
        return "\"" + key + "\":\"" + val + "\""

    string test()
        string p1 = build_prop("a", "1")
        string p2 = build_prop("b", "2")
        string result = "{" + p1 + "," + p2 + "}"
        return result

start()
    printl(test())
"#;

    // Should output: {"a":"1","b":"2"}
    // Currently crashes or produces garbage
}
```

## Expected Behavior

String concatenation with escape sequences should work reliably in plugins, allowing dynamic JSON construction.

## Impact

This blocks:
- Full JSON object serialization in `frame.httpserver` plugin
- Any plugin that needs to build complex strings dynamically
- Template expansion features in other plugins

## Priority

Medium - A workaround is in place (empty `{}`), but this limits the usefulness of the DSL. The server-side can potentially build the actual JSON from the request context.
