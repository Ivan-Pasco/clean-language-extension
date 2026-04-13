Component: clean-server
Issue Type: bug
Priority: critical
Source Component: Web Site Clean + frame.server plugin

## Summary

WASM compiled with compiler v0.30.48 + frame.server plugin fails to load on clean-server v1.9.0 with:

```
Failed to instantiate WASM module: incompatible import type for `env::_req_body_field`
```

The `frame.server` plugin.toml declares `_req_body_field` as:
```toml
{ name = "_req_body_field", params = ["string"], returns = "string", description = "Get form field by name from request body", expand_strings = true }
```

The compiled WASM imports this function, but clean-server v1.9.0 either:
1. Doesn't provide `_req_body_field` at all, or
2. Provides it with a different signature (different param/return types at the WASM level)

## To fix

Either:
- **clean-server**: Add/fix the `_req_body_field` bridge function to match the signature the compiler generates (takes i32+i32 string ptr+len, returns i32 string ptr)
- **frame.server plugin.toml**: Remove `_req_body_field` from bridge declarations if it's not implemented in clean-server

## Environment

- Compiler: v0.30.48
- Plugin: frame.server 2.1.0 (plugin.wasm 24,247 bytes, built 2026-04-07)
- Server: clean-server v1.9.0 (both local macOS and production Linux)

## Impact

Website server WASM compiles but cannot run. Blocks deployment.
