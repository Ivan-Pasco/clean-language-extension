# Compiler + Plugin — Template Block Mechanism

Component: clean-language-compiler + framework plugins
Issue Type: enhancement
Priority: high
Description: Add a generic "template block" mechanism that plugins can register. The compiler stays agnostic — it doesn't know about HTML, SQL, etc. It just knows "this plugin declared a block type that is a multi-line string template with `{var}` interpolation, returning `string`."

Context: The website project (and any SSR application) builds HTML via hundreds of `html = html + "..."` lines because Clean Language has no multi-line string support. The component `html:` block already proves the compiler can parse multi-line content with `{variable}` interpolation — this just needs to be generalized from component-only to any function context, driven by plugin declarations.

---

## Current State

Components already use `html:` blocks:

```clean
component: tag="feature-card"
    html:
        <div class="feature-card">
            <h3>{this.title}</h3>
            <p>{this.summary}</p>
        </div>
```

The compiler parses this, handles `{expression}` interpolation, and generates string concatenation WASM. But this only works inside `component:` blocks.

## What We Need

### Plugin Declaration (plugin.toml)

```toml
[template_blocks]
html = { returns = "string", interpolation = true }
sql = { returns = "string", interpolation = true }
```

This tells the compiler: "when you see `html:` or `sql:` inside a function body, treat the indented content as a multi-line string template."

### Usage in Functions

```clean
# Assignment — block content becomes a string value
string html = html:
    <div class='stat-cards'>
        <div class='stat-card'>
            <div class='stat-label'>Total Reports</div>
            <div class='stat-value'>{total_reports}</div>
        </div>
    </div>

# Append — block content is concatenated to existing variable
html += html:
    <div class='footer'>
        <p>{footer_text}</p>
    </div>

# Return — block content is the return value
return html:
    <html>
        <body>{content}</body>
    </html>
```

### What the Compiler Does (generic, plugin-agnostic)

1. Parser sees `identifier:` at statement level inside a function
2. Checks if `identifier` is a registered template block (from plugin.toml)
3. Collects all indented lines as raw text content
4. Processes `{expression}` interpolation (same logic as component html: blocks)
5. Generates string concatenation WASM — joins all lines, replacing `{expr}` with runtime values
6. Result type is whatever the plugin declared (`string` in all current cases)

### What the Compiler Does NOT Do

- Does NOT validate the content as HTML, SQL, or anything else
- Does NOT add any runtime imports or bridge functions
- Does NOT treat the block differently based on its name
- Simply: "multi-line string literal with interpolation, driven by plugin config"

## Why This Matters

### Before (current website code — 8 lines)
```clean
string html = build_dash_head("Error Dashboard")
html = html + "<div class='dash-container'>"
html = html + "<div class='dash-header'><h1 class='dash-title'>Error Dashboard</h1></div>"
html = html + "<div class='stat-cards'>"
html = html + "<div class='stat-card'><div class='stat-label'>Total Reports</div><div class='stat-value'>" + total_reports + "</div></div>"
html = html + "<div class='stat-card'><div class='stat-label'>New This Week</div><div class='stat-value'>" + week_reports + "</div></div>"
html = html + "</div>"
html = html + "</div>"
```

### After (with template blocks — readable, structured)
```clean
string html = build_dash_head("Error Dashboard")
html += html:
    <div class='dash-container'>
        <div class='dash-header'>
            <h1 class='dash-title'>Error Dashboard</h1>
        </div>
        <div class='stat-cards'>
            <div class='stat-card'>
                <div class='stat-label'>Total Reports</div>
                <div class='stat-value'>{total_reports}</div>
            </div>
            <div class='stat-card'>
                <div class='stat-label'>New This Week</div>
                <div class='stat-value'>{week_reports}</div>
            </div>
        </div>
    </div>
```

## Implementation Notes

### Compiler Changes

1. **Parser**: Extend function body parsing to recognize registered template block identifiers followed by `:`
2. **Block collection**: Use same indentation-based content collection as component `html:` blocks
3. **Interpolation**: Reuse existing `{expression}` interpolation from component html: parsing
4. **Codegen**: Generate the same string concatenation WASM already used for component templates
5. **Plugin loading**: Read `[template_blocks]` from plugin.toml during plugin initialization

### Plugin Changes (frame.httpserver)

Add to `plugin.toml`:
```toml
[template_blocks]
html = { returns = "string", interpolation = true }
```

### Plugin Changes (frame.data) — future

```toml
[template_blocks]
sql = { returns = "string", interpolation = true }
```

### Whitespace Handling

- Strip leading whitespace based on the indentation of the first content line (dedent)
- Lines are joined without newlines (HTML doesn't need them) — or make this configurable per block: `html = { returns = "string", interpolation = true, join = "" }` vs `sql = { join = " " }`
- Trailing whitespace on each line is trimmed

## v0.30.21 Status — Routing Added but Not Functional

The v0.30.21 fix ("route plugin block keywords to parse_framework_block inside function bodies") added routing at `token_parser.rs` line 2772-2776:

```rust
if self.plugin_keywords.contains(&first_name) {
    self.cursor -= 1;
    return self.parse_framework_block();
}
```

**`html` IS registered as a plugin keyword** — from `frame.ui/plugin.toml` `[handles] blocks = ["component", "screen", "page", "html"]`.

**But `parse_framework_block()` doesn't work for this use case:**

1. It's a Statement, not an Expression — can't be used in assignments (`string x = html:` fails with "Expected variable name after type")
2. The lexer tokenizes HTML content before the parser sees it — `<` becomes `Less`, single quotes `'` cause "Invalid character" errors
3. Standalone `html:` as a statement fails with "Unexpected token in expression: Less"

**What's needed:**
- Either a new `parse_template_block()` that collects raw text lines (like component html: does) and returns an Expression (not Statement)
- Or extend `parse_framework_block()` to support expression context and raw-text collection mode

**The component html: block works** because it has its own dedicated parser path that collects raw lines before lexing. Function-body template blocks need the same raw-text collection approach.

## Versions

- Compiler: v0.30.21 (routing added, not yet functional for template blocks)
- Framework: v2.6.1
