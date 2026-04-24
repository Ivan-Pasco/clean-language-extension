Component: clean-framework (frame.server plugin)
Issue Type: bug
Priority: critical
Source Component: Web Site Clean + clean-language-compiler v0.30.47

## Summary

The `frame.server` plugin (formerly `frame.httpserver`) cannot compile or run correctly with compiler v0.30.47. There are two separate issues:

1. **Newly compiled plugin.wasm** contains imports (`_session_store`, `_res_redirect`, etc.) that the compiler's plugin loader can't satisfy
2. **Old plugin.wasm** (33,169 bytes, compiled with older compiler) causes infinite loop when processing 2+ routes on v0.30.47

Neither version works. The website cannot be built.

## What works (from the old plugin)

The old plugin.wasm (33,169 bytes) has the correct behavior:
- **No session/auth imports** — doesn't reference `_session_store`, `_session_delete`, `_res_redirect`
- **Correct `expand()` output** for single routes
- Works on compiler versions up to ~v0.30.38

This plugin was compiled with an older compiler that did NOT auto-inject session/response bridge imports into all WASM modules.

## What breaks in v0.30.47

### Issue 1: Compiler auto-injects unavailable imports

Starting from some version (between v0.30.38 and v0.30.47), the compiler adds these imports to ALL compiled WASM — including plugin WASM:

```
_session_store
_session_delete  
_session_get (as env_session_get)
_auth_get_session
_res_redirect
_res_set_header
_res_status
_res_body
_res_json
http_get
http_post
... (many more HTTP client functions)
```

These are injected regardless of:
- Whether the source code references them
- Whether the plugin.toml declares them
- Whether they're commented out in plugin.toml

The plugin loader then fails with:
```
Failed to instantiate plugin module: unknown import: `env::_session_create` has not been defined
```

**Proof:** Even a minimal 3-function plugin (expand/validate/get_keywords) gets these imports.

### Issue 2: Old plugin infinite-loops on v0.30.47

The old 33,169-byte plugin.wasm (which has no problematic imports) causes the compiler to hang at 96% CPU when processing `endpoints server:` blocks with 2+ routes. Single routes work fine.

This suggests the compiler's plugin execution runtime changed in v0.30.47 in a way that causes string processing loops in the plugin to diverge.

## What needs to be fixed

### Option A: Fix the compiler
1. Stop auto-injecting session/response/HTTP-client imports into plugin WASM — plugins only need the functions they actually call
2. Fix the plugin execution runtime so that string-heavy operations (like `expand_endpoints` with multiple routes) don't infinite-loop

### Option B: Fix the plugin
1. Rebuild the plugin source to avoid patterns that trigger the infinite loop on v0.30.47
2. The plugin source is at `~/.cleen/plugins/frame.server/src/main.cln`
3. The core `expand_endpoints` function uses `while` loops with `indexOf`/`substring` to parse route declarations — the infinite loop is likely in the `remaining` advancement logic

### Recommended: Both

The compiler should not inject unused imports. AND the plugin should be tested against the current compiler.

## Files

| File | Size | Status |
|------|------|--------|
| `~/.cleen/plugins/frame.server/src/main.cln` | source | Identical to frame.httpserver source |
| `~/.cleen/plugins/frame.server/plugin.toml` | config | Bridge function declarations |
| `~/.cleen/plugins/frame.server/plugin.wasm` | compiled | Currently broken (has unavailable imports) |
| `~/.cleen/plugins/frame.httpserver/2.6.1/plugin.wasm.old` | 33,169 bytes | Old working plugin (no bad imports, but infinite-loops on v0.30.47) |

## Rename note

The plugin was renamed from `frame.httpserver` to `frame.server`. The website already updated all references. Both directories exist with the same source code. The `frame.httpserver` directory should be deprecated/removed after `frame.server` works.

## Impact

The Clean Language website (cleanlanguage.dev) cannot be built or deployed until this is fixed. All 24 routes depend on the `endpoints server:` block.
