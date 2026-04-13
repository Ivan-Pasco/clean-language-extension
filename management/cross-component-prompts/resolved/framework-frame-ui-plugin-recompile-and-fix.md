Component: clean-framework (frame.ui plugin)
Issue Type: bug
Priority: critical
Description: The frame.ui plugin.wasm must be recompiled with compiler 0.30.38+ and two source bugs must be fixed before recompilation. The current plugin binary (compiled with 0.22.0) has NO-OP stubs for all string methods, causing all plugin block expansion to produce corrupted output.

---

## Background

The compiler team investigated the "string corruption during expand_block" bug reported in `compiler-plugin-expand-string-regression-v0-30.md`. The root cause is **not** a compiler runtime bug. The plugin binary itself contains broken code.

### Root Cause

The frame.ui plugin.wasm (98,417 bytes, compiled with compiler 0.22.0) has NO-OP stub implementations for critical string functions:

| Function | Actual WASM | Should Do |
|----------|-------------|-----------|
| `string.replace` | `local.get 0; end` (returns input unchanged) | Replace substrings |
| `string.replaceAll` | `local.get 0; end` | Replace all occurrences |
| `string.trim` | `local.get 0; end` | Trim whitespace |
| `string.trimStart` | `local.get 0; end` | Trim leading whitespace |
| `string.trimEnd` | `local.get 0; end` | Trim trailing whitespace |
| `string.toUpperCase` | `local.get 0; end` | Convert to uppercase |
| `string.toLowerCase` | `local.get 0; end` | Convert to lowercase |

Confirmed by disassembly:
```
002661 func[81] <string.replace>:
 002662: 20 00                      | local.get 0
 002664: 0b                         | end
```

### Impact Chain

1. `escape_json_string()` calls `.replace("\"", "\\\"")` → no-op → quotes stay unescaped
2. JSON becomes `{"before":"tag="site-header"..."}` (malformed)
3. `extract_json_field()` reads value until first unescaped `"` → truncates
4. `expand_component` gets empty tag, empty html_content
5. Output: `tag=` and empty `__html`

## Required Source Code Fixes

### Fix 1: Replace `list.append` with `list.add` (line 2581)

`list.append` is **not** in the Clean Language Specification. The spec defines `list.add` and `list.push`.

**File:** `~/.cleen/plugins/frame.ui/src/main.cln`
**Line 2581:**
```clean
// BEFORE (wrong):
events = events.append(event_entry)

// AFTER (correct):
events = events.add(event_entry)
```

### Fix 2: Verify `html_block_to_code` function

After recompilation with working string functions, the `html_block_to_code` function should now work correctly since `string.replace` will actually replace strings. However, the component expansion still produces empty `__html` content in the render function.

Test case:
```clean
plugins:
	frame.ui

component: tag="test"
	html:
		<h1>Hello World</h1>
```

Expected output from `expand_component` should include:
```clean
string __html = ""
__html = __html + "<h1>Hello World</h1>\n"
return __html
```

But currently produces:
```clean
string __html = ""

return __html
```

**Investigation needed:** With working string functions, trace `parse_component_body` → `strip_block_indent` → `html_block_to_code` to verify:
1. `parse_component_body` correctly finds `html:` in the body and extracts its content
2. `strip_block_indent` doesn't strip the content to empty
3. `html_block_to_code` receives non-empty input and produces render code

The compiler now passes attributes as JSON: `{"tag":"test"}` (not `tag=test`). The plugin's `get_attr` function expects this format, so attribute parsing should work correctly.

The compiler also extracts inline `key="value"` pairs from the first line of block content. So `component: tag="test"` passes `{"tag":"test"}` as attributes and the remaining indented content as body.

## Recompilation Instructions

After fixing the source code:

```bash
cd /path/to/clean-language-compiler

# Compile with plugin target (excludes server-specific imports)
cargo run --bin cleanc -- compile ~/.cleen/plugins/frame.ui/src/main.cln ~/.cleen/plugins/frame.ui/plugin.wasm --target=plugin

# Also update the versioned copy
cp ~/.cleen/plugins/frame.ui/plugin.wasm ~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm
```

**IMPORTANT:** Use `--target=plugin` flag. Without it, the compiler includes server-side imports (`_res_redirect`, `_http_route`, etc.) that the plugin runtime doesn't provide, causing instantiation failures.

## Compiler Changes Already Made

The compiler (0.30.38) now has these fixes that support the recompiled plugin:

1. **Contextual keywords as variable names** — `string rules = ""` now compiles (was blocking plugin compilation)
2. **Codegen fix for deeply nested while loops** — `parse_component_body` no longer hits `unreachable` trap
3. **Attribute formatting** — attributes passed to `expand_block` are now JSON: `{"tag":"site-header"}`
4. **Inline attribute extraction** — `component: tag="site-header"` correctly separates attrs from body content

## Verification

After recompilation, test with:

```bash
# Test html: block (should already work)
echo 'plugins:
	frame.ui

start:
	print(render())

functions:
	string render()
		html:
			<h1>Hello World</h1>' > /tmp/test_html.cln

cln compile /tmp/test_html.cln -o /tmp/test_html.wasm --plugins

# Test component: block (the main fix target)
echo 'plugins:
	frame.ui

component: tag="site-header"
	html:
		<header class="site-header">
			<nav>Article Blog</nav>
		</header>' > /tmp/test_component.cln

cln compile /tmp/test_component.cln -o /tmp/test_component.wasm --plugins
```

Both should compile without errors. The component test should produce a class with a `render()` function that contains actual HTML concatenation code, not empty `__html`.

## Files Affected

- `~/.cleen/plugins/frame.ui/src/main.cln` — line 2581: `list.append` → `list.add`
- `~/.cleen/plugins/frame.ui/plugin.wasm` — recompile from fixed source
- `~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm` — copy recompiled binary

## Related Prompts

- `compiler-plugin-expand-string-regression-v0-30.md` — original bug report (this prompt resolves it)
- `compiler-html-block-empty-output-v0-30-38.md` — empty html: output (same root cause)
- `framework-frame-ui-html-expand-empty-body.md` — empty body in expand (same root cause)
- `compiler-string-literal-assignment-regression.md` — `string x = "literal"` parsing (fixed in compiler)
