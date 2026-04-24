Component: clean-framework (frame.ui plugin)
Issue Type: enhancement
Priority: critical
Description: The frame.ui plugin.wasm must be recompiled with compiler v0.30.39+ to get working html: and component: block expansion. The current binary (compiled with 0.22.0) has NO-OP string method stubs that make ALL plugin block expansion produce empty/corrupted output.

---

## What Changed in the Compiler

Compiler commits `41f9cbb`, `d675203`, and `9b47428` fixed **6 critical codegen bugs** that affected plugin compilation and execution:

1. **Parameter aliasing** — `string remaining = content` reused the same WASM local, corrupting the parameter
2. **Chained string method dispatch** — `Ptr(U8)` mapped to `Null` type, causing `.substring().trim()` to dispatch to `print` instead of `trim`
3. **String method return type inference** — 22 string methods returned `Unknown` type, breaking method chaining
4. **Empty string corruption** — legacy heap pointer at address 0 overwrote the empty string's length prefix with 1024
5. **Nested while loop codegen** — code after deeply nested while loops was dropped
6. **`this` keyword** — now resolves correctly in class method scopes
7. **Plugin output parsing** — uses production parser instead of legacy pest grammar

## Action Required

Recompile the frame.ui plugin with the latest compiler:

```bash
# From the clean-language-compiler directory (must be v0.30.39+)
cargo run --bin cleanc -- compile ~/.cleen/plugins/frame.ui/src/main.cln ~/.cleen/plugins/frame.ui/plugin.wasm --target=plugin

# Also update versioned copy
cp ~/.cleen/plugins/frame.ui/plugin.wasm ~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm
```

**IMPORTANT:** Use `--target=plugin` to exclude server-specific imports (`_res_redirect`, `_http_route`, etc.) that the plugin runtime doesn't provide.

## Verification

After recompilation, test:

```bash
# Test 1: html: block in function body
echo 'plugins:
	frame.ui

start:
	string result = render()
	printl(result)

functions:
	string render()
		html:
			<h1>Hello World</h1>' > /tmp/test_html.cln

cln compile /tmp/test_html.cln -o /tmp/test_html.wasm --plugins
# Should compile successfully

# Test 2: component: block
echo 'plugins:
	frame.ui

component: tag="test-widget"
	html:
		<div>Hello World</div>' > /tmp/test_comp.cln

cln compile /tmp/test_comp.cln -o /tmp/test_comp.wasm --plugins
# Should compile successfully
```

## Expected Plugin Binary Size

- Old binary (0.22.0): 98,417 bytes — has NO-OP string stubs
- New binary (0.30.39+): ~108,156 bytes — has real string implementations

The size increase is from real `trim`, `indexOf`, `substring`, `startsWith`, `endsWith`, etc. implementations that were previously empty stubs.

## What Was Wrong With the Old Binary

The plugin compiled by v0.22.0 had these functions as single-instruction no-ops (`local.get 0; end`):

- `string.replace` / `string.replaceAll`
- `string.trim` / `string.trimStart` / `string.trimEnd`
- `string.toUpperCase` / `string.toLowerCase`

This caused `escape_json_string()` to fail (replace was no-op), which corrupted all JSON-based data passing between internal plugin functions. The `html_block_to_code` function received empty content because `strip_block_indent` couldn't process strings correctly.

## Impact

After recompilation:
- ALL html: blocks will produce correct HTML output
- ALL component: blocks will generate proper class declarations with render() methods
- ALL screen: blocks will expand correctly
- The 7 SSR website pages should render HTML content again

## Related

- `compiler-plugin-expand-string-regression-v0-30.md` — original bug report (RESOLVED)
- `compiler-html-block-empty-output-v0-30-38.md` — empty html output (RESOLVED)
- `framework-frame-ui-html-expand-empty-body.md` — empty body (RESOLVED)
- `framework-frame-ui-plugin-recompile-and-fix.md` — earlier recompile prompt (SUPERSEDED by this one)
