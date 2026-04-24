# Compiler — Plugin Loader Missing `list.push_f64` Host Function

Component: clean-language-compiler
Issue Type: bug
Priority: CRITICAL — blocks `endpoints:` DSL syntax for all Frame apps
Date: 2026-02-25

---

## Problem

The compiler's **plugin loader** fails to instantiate plugin WASM modules because it does not provide the `list.push_f64` host function. This blocks the `endpoints:` DSL block expansion from the frame.httpserver plugin.

**This is NOT a clean-server issue.** clean-server already implements `list.push_f64` (in `host-bridge/src/wasm_linker/list_funcs.rs`). The problem is that the **compiler itself** also instantiates plugin WASM modules at compile time to expand DSL blocks — and the compiler's mini WASM runtime does not provide `list.push_f64`.

## Error

```
error[E001]: Plugin 'frame.httpserver' failed to expand 'endpoints:':
  Failed to instantiate plugin module: unknown import: `env::list.push_f64` has not been defined
  at app/api/main.cln:9:1
```

## How Plugin Expansion Works

1. Compiler encounters `endpoints server:` block in a `.cln` file
2. Compiler loads `frame.httpserver/2.6.1/plugin.wasm` into a mini WASM runtime
3. The plugin WASM module has imports (host functions it needs)
4. Compiler provides some host functions to the plugin (string ops, etc.)
5. **`list.push_f64` is NOT provided** → instantiation fails → expansion fails

## What the Plugin WASM Needs

```
env::list.push_f64 = (i32, f64) -> (i32)
```

- `i32` param 1: list pointer (length-prefixed, 16-byte header)
- `f64` param 2: float value to push
- `i32` return: updated list pointer (same pointer, mutated in-place)

## Fix

In the compiler's plugin loader (likely `src/codegen/plugin_loader.rs` or similar), add `list.push_f64` to the set of host functions provided to plugin WASM modules during instantiation.

The implementation should match clean-server's version in `host-bridge/src/wasm_linker/list_funcs.rs`:
1. Read the 16-byte list header at `ptr`: `[element_size: i32, length: i32, capacity: i32, type_tag: i32]`
2. Verify `length < capacity`
3. Calculate element offset: `ptr + 16 + (length * 8)` (f64 = 8 bytes)
4. Write the f64 value at that offset
5. Increment length in the header
6. Return `ptr`

## Context

The `endpoints:` syntax is the modern Frame way to define HTTP routes:

```clean
endpoints server:
    GET "/api/health" :
        return api_health()
    POST "/api/users" :
        return create_user()
```

Without this fix, all Frame apps must use the legacy manual routing:

```clean
start:
    s = _http_route("GET", "/api/health", 0)
functions:
    string __route_handler_0()
        return api_health()
```

## Audit Suggestion

The plugin loader should be audited for ALL missing host functions. Run the plugin WASM through a WASM import extractor to find every import it needs, and verify the compiler's plugin loader provides all of them. The frame.httpserver plugin WASM has 331 exports — its imports may include other functions besides `list.push_f64`.

## Files Affected

- Compiler plugin loader (the module that instantiates plugin WASM for DSL expansion)
- Look for `Plugin Loader` log messages in the build output — these come from the relevant code

## Versions

- Compiler: 0.30.19
- frame.httpserver plugin: 2.6.1
- clean-server: 1.8.11 (has `list.push_f64` — NOT the issue)
