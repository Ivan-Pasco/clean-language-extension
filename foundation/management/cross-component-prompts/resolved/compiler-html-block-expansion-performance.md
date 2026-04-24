Component: clean-language-compiler
Issue Type: bug
Priority: critical
Description: html: block expansion hangs on projects with multiple/large html: blocks — compiler uses 100% CPU indefinitely
Context: After fixing the frame.ui plugin quote conversion bug and session import issue, html: blocks now expand correctly for minimal test cases. However, compiling the Clean Language website (8 page files with ~27 html: blocks total) causes the compiler to hang at 100% CPU for 15+ minutes without producing output. A minimal single-block test compiles in ~60 seconds.

## Reproduction

Minimal case (works, ~60 seconds):
```clean
plugins:
    frame.httpserver
    frame.ui

endpoints server:
    GET "/" :
        return http.respond(200, "text/html", test_page())

functions:
    string test_page()
        html:
            <h1>Hello</h1>
```
Produces valid 8780-byte WASM.

Full project (hangs):
```bash
cd "Web Site Clean"
cln compile --plugins -o dist/server.wasm app/server/main.cln
# Loads all 3 plugins successfully, then hangs at 100% CPU
# No output after 15+ minutes
```

The project has:
- 8 imported page files (components.cln, home.cln, get_started.cln, syntax.cln, modules.cln, docs.cln, errors_dashboard.cln, errors_detail.cln)
- ~27 html: blocks across these files (many in components.cln which has ~15 small blocks for reusable card components)
- Some html: blocks use `{var}` and `{!var}` interpolation
- Some html: blocks are large (home.cln, get_started.cln have ~60-80 line blocks)

## Environment
- Compiler: v0.30.40
- Plugin: frame.ui 2.4.0 (plugin.wasm 86478 bytes)
- Plugin: frame.httpserver (plugin.wasm 33169 bytes)
- Plugin: frame.data (plugin.wasm 50512 bytes)
- macOS ARM64

## Analysis
The compiler loads all 3 plugins successfully and begins processing. The `ps` output shows 97.6% CPU usage — the compiler is actively computing, not deadlocked. But it never completes. This suggests exponential or polynomial scaling in the html: block expansion algorithm — possibly re-expanding blocks for each import, or re-running the plugin WASM for each block with cumulative state.

With the old plugin (v2.3.0 and earlier), the same project compiled in ~10 seconds. The expansion was producing empty output but was fast. The new v2.4.0 plugin that actually generates correct expansion code is dramatically slower.

## Impact
The website cannot be compiled. All other code changes (json.get migration, cache headers, SSR tables, etc.) are complete and correct but untestable.

## Suggested investigation
- Profile the html: block expansion to find the bottleneck
- Check if the plugin's expand_block is called once per block or if there's re-expansion
- Check if the expansion output size grows quadratically with the number of blocks
- The old plugin compiled the same project in ~10 seconds (albeit with empty output) — compare what changed
