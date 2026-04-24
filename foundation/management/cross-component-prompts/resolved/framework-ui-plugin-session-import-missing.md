Component: clean-framework/plugins/frame.ui
Issue Type: bug
Priority: critical
Description: frame.ui plugin v2.4.0 WASM imports `env::_session_create` which is not provided by the compiler's plugin loader
Context: After fixing the single-quote-to-double-quote conversion bug, the frame.ui v2.4.0 plugin WASM now fails to instantiate because it imports `_session_create` from the `env` namespace, but the compiler's plugin loader doesn't define this function.

## Error

```
error[E001]: Plugin 'frame.ui' failed to expand 'html:':
  Failed to instantiate plugin module: unknown import: `env::_session_create` has not been defined
```

This affects every html: block in every page file (all 8 pages fail).

## Cause

The frame.ui plugin WASM was compiled with a dependency on `_session_create` (likely from frame.auth). The compiler's plugin loader only provides a limited set of host functions for plugin instantiation — it doesn't include auth/session functions since plugins run at compile time, not at request time.

## Fix

Either:
1. Remove the `_session_create` import from the frame.ui plugin WASM (don't link auth dependencies into the UI plugin)
2. Or have the compiler's plugin loader provide a no-op stub for `_session_create`

Option 1 is preferred — the UI plugin should not depend on session management at compile time.

## Environment
- Compiler: v0.30.39
- Plugin: frame.ui 2.4.0 (plugin.wasm 100424 bytes, Apr 3 23:20)
- The previous issue (single-to-double quote conversion) appears to be fixed in this version

## Impact
All html: block compilation is blocked. No SSR pages can be rendered.
