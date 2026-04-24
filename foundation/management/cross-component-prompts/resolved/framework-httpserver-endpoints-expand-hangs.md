Component: clean-framework (frame.httpserver → frame.server migration)
Issue Type: bug
Priority: critical
Description: The frame.httpserver plugin (v2.0.0) is deprecated and replaced by frame.server (v2.1.0), but some projects still reference the old name. The old plugin hangs when expanding `endpoints server:` blocks due to NO-OP string method stubs compiled with old compiler v0.22.0.

## Resolution

**frame.httpserver is deprecated.** The replacement is **frame.server** (v2.1.0). Projects referencing `frame.httpserver` in their `plugins:` block must be updated to `frame.server`.

The old frame.httpserver plugin (v2.0.0, 33169 bytes) should NOT be recompiled — it should be retired. The frame.server plugin (v2.1.0) is the current version and may also need recompilation with compiler v0.30.41+ if it has the same NO-OP string stub issue.

## Evidence

The old frame.httpserver plugin hangs at 100% CPU when processing `endpoints server:` blocks:
- Plugin loads successfully (33169 bytes, 322 exports)
- The compiler calls `expand("endpoints", attrs, body)` on the plugin WASM
- The WASM `expand()` function never returns
- Root cause: NO-OP string method stubs from old compiler (same as frame.ui issue)

## Action Items

1. **Website and all projects**: Change `frame.httpserver` → `frame.server` in `plugins:` blocks
2. **frame.server plugin**: Verify it's compiled with compiler v0.30.41+ (or recompile if needed)
3. **frame.httpserver**: Can be removed from `~/.cleen/plugins/` — it's superseded by frame.server

## Files Affected (Website)

- `Web Site Clean/app/server/main.cln` line 2: `frame.httpserver` → `frame.server`

## Related

- `framework-frame-ui-plugin-recompile-and-fix.md` — same root cause (NO-OP string stubs) in frame.ui
- `compiler-dead-import-elimination-for-plugins.md` — compiler fix that enabled plugin recompilation
