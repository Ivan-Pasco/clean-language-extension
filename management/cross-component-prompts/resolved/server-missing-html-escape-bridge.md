Component: clean-server
Issue Type: bug
Priority: critical
Source Component: compiler v0.30.50

## Summary

Compiler v0.30.50 generates WASM that imports `env::_html_escape` for `html:` block `{var}` interpolation. clean-server v1.9.0 does not provide this function.

```
Failed to instantiate WASM module: unknown import: `env::_html_escape` has not been defined
```

## What it should do

`_html_escape(ptr, len) -> (ptr, len)` — takes a string and returns it with HTML entities escaped (`<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`, `"` → `&quot;`).

This is needed for `{var}` safe interpolation in `html:` blocks (as opposed to `{!var}` raw insertion).

## Simple implementation

```rust
fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
```

Register as a host function with standard Clean string ptr+len calling convention.

## Environment

- Compiler: v0.30.50
- Server: v1.9.0
