Component: clean-server
Issue Type: bug
Priority: critical
Status: RESOLVED - commit 4633c50 (2026-04-07)
Source Component: Web Site Clean + frame.server plugin v2.10.9 + compiler v0.30.48

## Summary

WASM compiled with compiler v0.30.48 + frame.server plugin (from framework v2.10.9) fails to load on clean-server v1.9.0:

```
Failed to instantiate WASM module: incompatible import type for `env::_http_route`
```

The frame.server plugin.toml declares `_http_route` as:
```toml
{ name = "_http_route", params = ["string", "string", "handler"], returns = "integer", description = "Register route: method, path, handler function", expand_strings = true }
```

The third param is `handler` (a function pointer/index). The compiler v0.30.48 likely generates this as a different WASM type than what clean-server v1.9.0 expects (was probably `i32` before, may now be a different type or have additional params).

## Previous working state

The website previously compiled and ran with:
- Compiler v0.30.22-v0.30.38
- frame.httpserver plugin (now renamed to frame.server)
- clean-server v1.7.11 (production) and v1.8.11

## What changed

- Compiler updated to v0.30.48
- Plugin updated via `cleen frame install latest` (v2.10.9)
- The `_http_route` import signature in the generated WASM no longer matches clean-server v1.9.0

## To fix

clean-server needs to accept the `_http_route` import signature that compiler v0.30.48 generates. The Rust source is at:
```
/Users/earcandy/Documents/Dev/Clean Language/clean-server/
```

Check what WASM signature the new WASM expects for `_http_route` and update the host function binding to match.

## Impact

Website server WASM compiles but cannot run on any available clean-server version. Blocks deployment.
