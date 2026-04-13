# Compiler: Parse Framework Blocks Inside Function Bodies

Component: clean-language-compiler
Issue Type: bug
Priority: high
Description: `html:` blocks (and any registered plugin block name) do not work inside function bodies. The token parser's `parse_statement()` routes all `identifier:` patterns inside functions to `parse_function_apply_block()` instead of `parse_framework_block()`.
Context: Discovered while working in clean-framework. The frame.ui plugin already handles `html:` blocks correctly via `expand_html_block()`. The expander already walks into function bodies. The only missing piece is the token parser routing.

---

## Root Cause

In `src/parser/token_parser.rs`, `parse_statement()` (starting around line 2553), the `TokenKind::Identifier` branch checks at approximately line 2771:

```rust
if self.check(&TokenKind::Colon) {
    // This is a function apply block: FUNCTION:
    self.cursor -= 1;
    return self.parse_function_apply_block();
}
```

This unconditionally routes ALL `identifier:` patterns to `parse_function_apply_block()`. It never checks whether the identifier is a registered plugin block name.

**Contrast with the top-level parser** (lines 257-294), which already does:

```rust
let is_plugin_keyword = self.plugin_keywords.contains(name);
let is_framework_block = match self.peek_kind() {
    Some(&TokenKind::Colon) => true,
    ...
};
if is_framework_block {
    self.parse_framework_block_or_plugin(is_plugin_keyword)
}
```

The `TokenParser` struct already has a `plugin_keywords: HashSet<String>` field populated via `with_plugin_keywords()`. The `get_all_block_keywords()` method on `PluginRegistry` returns the registered block names (e.g., `["component", "screen", "page", "html"]` for frame.ui).

## Suggested Fix

In `parse_statement()`, in the `TokenKind::Identifier` branch, at the point where a colon is detected (line ~2771), insert a check before routing to `parse_function_apply_block`:

```rust
if self.check(&TokenKind::Colon) {
    // Check if identifier is a registered plugin block name
    if self.plugin_keywords.contains(&first_name) {
        // This is a plugin block inside a function body
        self.cursor -= 1;
        return self.parse_framework_block();
    }
    // Not a plugin block — standard function apply block
    self.cursor -= 1;
    return self.parse_function_apply_block();
}
```

Note: `first_name` is the variable holding the identifier text (around line 2630). The cursor has been advanced past it by line 2767.

## What Already Works

- **grammar.pest**: `framework_block` IS part of `statement` → pest grammar already supports this
- **expander.rs**: `expand_program()` → `expand_functions()` → `expand_statements()` already walks into function bodies and expands `Statement::FrameworkBlock` nodes
- **frame.ui plugin**: `expand_html_block()` generates correct function-body code (`string __html = "" ... return __html`)
- **plugin.toml**: frame.ui already lists `html` in `[handles].blocks`

## Files Affected

- `src/parser/token_parser.rs`: `parse_statement()`, the `TokenKind::Identifier` arm, around lines 2766-2775

## Test to Verify

After the fix, this Clean Language code should compile without error:

```clean
functions:
    string build_nav(string brand)
        html:
            <nav>
                <a href="/">{brand}</a>
            </nav>
```

The `html:` block should be parsed as `Statement::FrameworkBlock { name: "html", ... }` and routed to the frame.ui plugin's `expand_html_block()` function.

## Generality

This fix is intentionally generic — it works for ANY registered plugin block name, not just `html`. Any plugin that declares `blocks = ["foo"]` in its `plugin.toml` will automatically have `foo:` recognized inside function bodies.

## Versions

- Compiler: current (v0.30.x)
- Framework: v2.6.x (frame.ui plugin already updated to handle this)
