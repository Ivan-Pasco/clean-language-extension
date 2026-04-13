# Clean Language Compiler — html: Blocks Inside Function Bodies — Resolution

Component: clean-language-compiler (response to clean-compiler-html-block-lexer-raw-mode.md)
Issue Type: resolution
Priority: critical
Description: Resolution of the `html:` blocks failing inside function bodies bug.

---

## Status: FIXED in compiler — requires `plugins:` declaration in source files

## What Was Fixed (v0.30.21 → v0.30.22)

Three compiler fixes work together to support `html:` inside function bodies:

1. **Commit `38f1d49`** — Raw source text extraction for framework block content
   - Added `source_content: String` to `TokenStream`
   - Added `extract_block_content_raw()` — extracts raw source text using byte positions
   - This preserves HTML verbatim without reconstructing from tokens

2. **Commit `3f532b4`** — Plugin keyword colon routing inside function bodies
   - When parsing function body statements, if an identifier matches a plugin keyword AND is followed by `:`, routes to `parse_framework_block()`
   - This is the core routing that makes `html:` work inside functions

3. **Colon syntax fix in `parse_framework_block_or_plugin`**
   - When a plugin keyword uses colon syntax (`html:`), it's correctly delegated to `parse_framework_block()` instead of the plugin-without-colon path

## Architecture Decision: Separation of Concerns

The compiler does NOT contain any HTML-specific knowledge. The `html:` keyword is only recognized when:
1. A plugin declares `blocks = ["html"]` in its `plugin.toml`
2. The source file declares `plugins:` with that plugin
3. The compiler extracts plugin keywords and passes them to the parser

This means: **the source `.cln` files MUST have a `plugins:` block** that loads a plugin handling `html` blocks.

## What the Website Project Needs

For `html:` to work inside function bodies, the `.cln` source files must declare the plugin:

```clean
plugins:
    frame.ui

functions:
    string build_card(string title)
        html:
            <div class="card">
                <h1>{title}</h1>
            </div>
```

The `plugins:` block tells the compiler to load `frame.ui`'s `plugin.toml`, which declares:
```toml
[handles]
blocks = ["component", "screen", "page", "html"]
```

The compiler then registers `html` as a plugin keyword, enabling the parser to route `html:` to framework block parsing inside function bodies.

### Without `plugins:` declaration

If the source file does NOT have `plugins:`, the compiler has no knowledge of `html` as a block keyword, and `html:` inside a function body will be treated as a function apply block, causing the `Unexpected token: Less` error.

## Verification

Unit tests confirm:
- `html:` WITH plugin keywords → produces `FrameworkBlock` AST node with raw HTML content
- `html:` WITHOUT plugin keywords → NOT recognized as framework block (correct separation of concerns)
- Top-level `component:` blocks still work (regression check)
- Multi-line HTML, interpolation `{name}`, raw interpolation `{!nav_html}` all preserved

## If the Error Persists

If the website project still gets the error after adding `plugins:`, check:
1. The plugin's `plugin.toml` path is correct and accessible
2. The `[handles] blocks` list includes `"html"`
3. The compilation uses the multi-file compiler path (`compile_multi_file`)
