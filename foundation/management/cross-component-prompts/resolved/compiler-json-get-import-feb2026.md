# Cross-Component Prompt: Verify `_json_get` WASM Import Registration in Compiler

**Component:** clean-language-compiler
**Issue Type:** compatibility verification
**Priority:** high
**Created:** 2026-02-14
**Source Component:** clean-framework (frame.auth plugin declares `_json_get` bridge function)
**Status:** Verified - All checks pass

---

## Summary

The `frame.auth` plugin declares `_json_get(string, string) -> string` as a bridge function in `plugin.toml`. When a `.cln` file calls `_json_get(jsonStr, "user.email")`, the compiler must generate a WASM import for `env._json_get` with the correct signature.

The compiler already has `__json_get_field` and `__json_get_index` as **internal intrinsics** for the `.field` accessor syntax on parsed JSON objects. These are different from the plugin-declared `_json_get` which operates on **raw JSON strings**.

---

## The Two Different Functions

| Function | Source | Purpose | Signature |
|----------|--------|---------|-----------|
| `__json_get_field` | Compiler intrinsic (`json_class.rs`) | Access field on parsed JSON `any` value via `.field` syntax | `(any_ptr, key_ptr, key_len) -> i32` |
| `__json_get_index` | Compiler intrinsic (`json_class.rs`) | Access element on parsed JSON array via `[index]` syntax | `(any_ptr, index) -> i32` |
| `_json_get` | Plugin bridge function (`frame.auth/plugin.toml`) | Extract value from **raw JSON string** by dot-path | `(json_ptr, json_len, path_ptr, path_len) -> i32` |

These serve completely different purposes. `__json_get_field` works on in-memory JSON structures. `_json_get` parses a raw string and navigates by dot-path.

---

## What Needs Verification

### 1. Plugin Bridge Function Import Generation

When the compiler processes a `.cln` file that imports a plugin declaring bridge functions (via `plugin.toml [bridge] functions`), it should generate WASM imports for those functions.

**Verify that calling `_json_get(jsonStr, path)` in Clean code generates:**

```wasm
(import "env" "_json_get" (func $._json_get (param i32 i32 i32 i32) (result i32)))
```

The `expand_strings = true` flag in the plugin.toml declaration means each `string` parameter expands to `(ptr, len)` — so 2 string params become 4 i32 params.

### 2. No Name Collision

Verify that `_json_get` (single underscore, plugin bridge) does not collide with `__json_get_field` (double underscore, compiler intrinsic). They should coexist without conflict.

### 3. Plugin Bridge Declaration

From `clean-framework/plugins/frame.auth/plugin.toml`:
```toml
[bridge]
functions = [
  # ...
  { name = "_json_get", params = ["string", "string"], returns = "string", description = "Get nested value from JSON: json, path (e.g., 'claims.role')", expand_strings = true },
]
```

---

## Files to Check

| File | What to Verify |
|------|---------------|
| `src/codegen/mir_codegen.rs` | Plugin bridge functions generate correct WASM imports |
| `src/codegen/expression_generator.rs` | `_json_get()` calls generate correct parameter passing |
| `src/stdlib/json_class.rs` | `__json_get_field`/`__json_get_index` don't interfere |
| `src/semantic/` | `_json_get` is recognized as a valid function when plugin is loaded |

---

## Test Case

```clean
// File: app/auth/test.cln (auto-loads frame.auth plugin)

start:
    string claims = "{\"role\": \"admin\", \"user\": {\"id\": 42, \"email\": \"admin@test.com\"}}"
    string role = _json_get(claims, "role")
    string email = _json_get(claims, "user.email")
    printl(role)    // Expected: "admin"
    printl(email)   // Expected: "admin@test.com"
```

**Expected WASM output should include:**
- Import: `(import "env" "_json_get" (func (param i32 i32 i32 i32) (result i32)))`
- Call site: loads string pointer+length for both arguments, then calls `_json_get`

---

## Verification Results (2026-02-14)

### 1. Plugin Bridge Function Import Generation - PASS

The compiler correctly handles plugin bridge functions through a well-defined pipeline:

1. **Parsing**: `src/plugins/plugin_abi.rs` parses `BridgeFunction` structs from `plugin.toml`, including `expand_strings` flag (line 115)
2. **Semantic Registration**: `src/semantic/mod.rs:1420` - `register_plugin_bridge_functions()` converts bridge function types to AST types and registers them via `register_builtin()`, making `_json_get` available for type checking
3. **Resolver Registration**: `src/resolver/resolver_impl.rs` registers bridge functions before resolving, allowing `_json_get()` calls to be recognized
4. **WASM Import Generation**: `src/codegen/mir_codegen.rs:5815` - `register_plugin_bridge_imports()` generates the correct WASM import

When `_json_get(string, string) -> string` with `expand_strings=true` is declared, the compiler generates:
```wasm
(import "env" "_json_get" (func (param i32 i32 i32 i32) (result i32)))
```
This is correct: 2 string params expand to 4 i32 params (ptr+len each).

### 2. No Name Collision - PASS

- `_json_get` (single underscore) = plugin bridge function, registered as WASM import from "env" module
- `__json_get_field` (double underscore) = compiler intrinsic, registered as internal WASM function in `json_class.rs:387`
- `__json_get_index` (double underscore) = compiler intrinsic, registered as internal WASM function in `json_class.rs:409`

These use different naming conventions, different registration paths (import vs internal function), and serve completely different purposes. No collision possible.

### 3. expand_strings Wrapper Generation - PASS

The two-stage wrapper system works correctly (`mir_codegen.rs:5934-5999`):

1. **Raw import** registered with expanded signature (strings as ptr,len pairs) - line 5876
2. **Wrapper function** registered as internal WASM function that:
   - Takes Clean Language string pointers (length-prefixed: `[i32 len][content]`)
   - Extracts content pointer (ptr+4) and length (load from ptr)
   - Calls the raw import with expanded parameters
   - This is deferred until after all imports are complete to avoid index collisions

### 4. Optimization Note

The compiler only imports bridge functions that are **actually used** in the code (line 5820-5823). If a `.cln` file never calls `_json_get()`, no import is generated.

---

## Context

The Website team and framework both use `_json_get` for extracting values from JSON response strings (database query results, API responses, JWT claims). The node server already implements it. The Rust server needs it (see companion prompt `clean-server-json-get-feb2026.md`). This prompt ensures the compiler correctly generates the import so both servers can provide the function.
