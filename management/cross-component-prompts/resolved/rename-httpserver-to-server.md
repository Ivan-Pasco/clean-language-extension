Component: clean-framework (frame.httpserver plugin)
Issue Type: enhancement
Priority: medium
Description: Rename frame.httpserver to frame.server

## Context

As part of the frame.client plugin design (spec 14), we audited all plugin names for clarity and intuitiveness. `frame.httpserver` is verbose and exposes an implementation detail. The developer thinks "I want to define my server endpoints", not "I want an HTTP server."

## Change

| Before | After |
|--------|-------|
| `import frame.httpserver` | `import frame.server` |
| `plugins/frame.httpserver/` | `plugins/frame.server/` |
| Plugin name in plugin.toml: `frame.httpserver` | `frame.server` |

Developer-facing syntax is unchanged: `endpoints:`, `req.*`, `res.*`, `json()`, `redirect()`.

## Plugin Name Alignment

After this rename, the full plugin map reads:

```
frame.ui      → What you SEE
frame.client  → What you SEND
frame.server  → What you SERVE
frame.data    → What you STORE
frame.auth    → What you SECURE
frame.canvas  → What you DRAW
```

Every plugin is one word that describes its purpose.

## Files Affected

- Rename folder `plugins/frame.httpserver/` → `plugins/frame.server/`
- Update `plugins/frame.server/plugin.toml`: change `name = "frame.httpserver"` to `name = "frame.server"`
- Update all specification docs that reference `frame.httpserver`
- Update CLAUDE.md plugin tables
- Update any CI/CD or build scripts that reference the old name

## Additional Change: handler type

While renaming, also update the `_http_route` and `_http_route_protected` bridge functions to use the `handler` param type instead of `integer` for their handler parameter. This aligns with the new `handler` type being added to the compiler (see `compiler-handler-type-for-plugins.md`).

```toml
# Before:
{ name = "_http_route", params = ["string", "string", "integer"], ... }

# After:
{ name = "_http_route", params = ["string", "string", "handler"], ... }
```

## No Backwards Compatibility Needed

Clean Language is not released. All existing example projects can be updated.
