Component: clean-language-compiler
Issue Type: bug
Priority: critical
Description: Compiler emits ALL known host function imports unconditionally, causing plugin instantiation failures

Context: The frame.ui plugin WASM fails to instantiate when loaded by the compiler's plugin loader because it imports functions like `_session_create`, `_session_get`, `_session_destroy`, `_auth_get_session`, etc. that the plugin loader doesn't provide. The frame.ui source code does NOT reference any of these functions — the compiler is emitting imports for every known host function regardless of actual usage.

## Evidence

The frame.ui `src/main.cln` contains zero references to session, auth, HTTP routing, or file I/O functions. Yet the compiled WASM contains 80 imports including:

- `env._session_create`, `env._session_get`, `env._session_destroy`, `env._session_set_cookie`
- `env._auth_get_session`, `env._auth_require_auth`, `env._auth_require_role`, `env._auth_can`, `env._auth_has_any_role`
- `env._http_route`, `env._http_listen`, `env._http_route_protected`
- `env.file_write`, `env.file_read`, `env.file_exists`, `env.file_delete`, `env.file_append`

Tested with both compiler v0.31.0 (80 imports) and v0.30.39 (86 imports) — same issue.

## Error When Loading Plugin

```
error[E001]: Plugin 'frame.ui' failed to expand 'html:':
  Failed to instantiate plugin module: unknown import: `env::_session_create` has not been defined
```

This blocks ALL html: block compilation — no SSR pages can be rendered.

## Recommended Fix (two options, either works)

### Option A: Dead-import elimination in codegen (preferred)
Only emit WASM imports for host functions that are actually called in the source code. During codegen, track which host functions are referenced and only generate import entries for those. This reduces binary size and prevents instantiation failures.

### Option B: Plugin loader provides stubs for all known host functions
When the compiler's plugin loader instantiates a plugin WASM module, provide no-op stub implementations for ALL known host functions (not just the subset currently provided). Since plugins run at compile time, these stubs would never be called — they just need to exist to satisfy WASM module instantiation.

Option A is architecturally cleaner. Option B is a faster fix.

## Files Affected
- `src/codegen/` — WASM import generation (for Option A)
- Plugin loader module that instantiates plugin WASM (for Option B)

## Impact
All frame.ui html: block compilation is blocked. No SSR pages can render. This affects every Frame project.
