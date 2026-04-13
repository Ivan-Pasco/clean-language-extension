Component: clean-language-compiler
Issue Type: bug
Priority: critical
Description: Plugin expand_block produces truncated/empty strings when running on compiler v0.30.22+. String literal values in plugin output are dropped — attributes like `tag="site-header"` become `tag=`, and html_block_to_code produces empty expansion. This affects ALL plugins that use string operations during expand_block.

Context: Discovered while verifying the fix for compiler-html-block-empty-output-v0-30-38.md. The frame.ui plugin.wasm (98,417 bytes, compiled with 0.22.0) was recompiled and committed. Testing revealed the plugin source code is correct, but the compiler's plugin runtime corrupts strings during expansion.

---

## Two Compiler Bugs Blocking html: Block Expansion

### Bug 1: String Literal Assignment Regression (already documented)

File: `compiler-string-literal-assignment-regression.md`

`string x = "literal"` fails to parse in 0.30.22+. This prevents compiling the frame.ui plugin with the current compiler. **Workaround**: compile plugin with 0.22.0.

### Bug 2: Plugin Runtime String Corruption During expand_block (THIS PROMPT)

When the compiler calls a plugin's `expand_block` WASM function, string values are corrupted or truncated in the plugin's output. This happens regardless of which compiler version compiled the plugin.wasm.

## Reproduction

```bash
# Using compiler 0.30.22 with frame.ui plugin (98,417 bytes, compiled with 0.22.0)
~/.cleen/versions/0.30.22/cln compile Header.cln -o test.wasm --plugins
```

Input file (Header.cln):
```clean
// Header Component

component: tag="site-header"
	html:
		<header class="site-header">
			<nav class="container">
				<a href="/" class="logo">Article Blog</a>
				<div class="nav-links">
					<a href="/">Home</a>
					<a href="/articles">Articles</a>
					<a href="/about">About</a>
				</div>
			</nav>
		</header>
```

### Debug output shows:

```
[Plugin Debug] Body content (274 chars): tag="site-header"
html:
	<header class="site-header">
		<nav class="container">
			<a href="/" class="logo">Article Blog</a>
			<div class="nav-links">
				<a href="/">Home</a>
				<a href="/articles"
[Plugin Debug] write_clean_string: len=274, ptr=524288, total_size=280, pages: 16->9
```

The body is correctly written to WASM memory (274 chars confirmed). But the plugin output is:

```
class Component
	string _hydration_mode = "off"
	string _slot_content = ""
	tag=

	functions:
		string render()
			string __html = ""
			
			return __html
```

**Two failures visible:**
1. `tag=` — the string `"site-header"` was lost from the attributes parameter
2. `string __html = ""` followed by empty line then `return __html` — the html_block_to_code function received or processed the body as empty

### Compiler 0.22.0 behavior (different bug):

```
[DEBUG] No import: block found, compiling without external plugins
```

Compiler 0.22.0 parses the `component:` as a framework block and stores it, but **never calls expand_block** on plugin blocks. The WASM output contains no user-defined functions (0 functions generated). This means 0.22.0 cannot produce working output for ANY plugin-expanded block.

## Root Cause Analysis

The plugin WASM uses host functions for string operations (`string.indexOf`, `string.substring`, `string.trim`, etc.). These host functions are implemented in the compiler's plugin runtime (`src/plugins/wasm_adapter.rs`).

When `expand_block` runs inside the 0.30.22 runtime:
1. The three string parameters (block_name, attributes, body) are written correctly to WASM memory
2. The plugin reads them and begins processing
3. During string operations (likely `indexOf`, `substring`, or string concatenation), values are corrupted or truncated
4. The plugin produces output with empty/missing string literal values

This is likely related to the previously-fixed string corruption bug (fix-plugin-string-corruption.md, marked fixed in v0.30.3/v0.30.4) having regressed, OR a separate issue in how the plugin runtime handles string memory for the `expand_block` call path specifically.

## Suggested Investigation

1. **Add debug logging to plugin string host functions** during expand_block execution:
   - Log every `string.indexOf`, `string.substring`, `string.trim` call with input/output pointers and content
   - Track where string content first becomes empty/corrupted

2. **Check memory page management**: The debug shows `pages: 16->9` — the memory was SHRUNK during write_clean_string. This is suspicious and could be corrupting existing allocations.

3. **Test with a minimal plugin** that just echoes back its body parameter:
   ```clean
   functions:
       string expand_block(string block_name, string attributes, string body)
           return "// body was: " + body
   ```
   If this also returns empty body, the bug is in parameter passing. If it works, the bug is in string operations during processing.

4. **Compare string host function implementations** between 0.22.0 and 0.30.22 for regressions

## Impact

- ALL plugin block expansion is non-functional on 0.30.22+
- The html: block feature (core to frame.ui) cannot work
- component:, screen:, data: blocks from all plugins are affected
- The website (7 SSR pages) cannot render any plugin-generated content

## Version Matrix

| Compiler | Plugin Loading | expand_block Called | String Output | Status |
|----------|---------------|-------------------|---------------|--------|
| 0.22.0   | Not loaded    | Never called      | N/A           | Framework blocks stored but not expanded |
| 0.30.22  | Loaded OK     | Called OK         | Corrupted     | String values truncated/empty in output |
| 0.30.38  | Loaded OK     | Called OK         | Corrupted     | Same as 0.30.22 |

## Files Affected

- `src/plugins/wasm_adapter.rs` — Plugin runtime string host functions, memory management
- `src/plugins/mod.rs` — Plugin state management, string passing
- `src/parser/` — Framework block routing to expand_block
- Plugin memory page management (the `pages: 16->9` shrink)

## Related Prompts

- `compiler-string-literal-assignment-regression.md` — Bug 1 (string literal parsing)
- `compiler-html-block-empty-output-v0-30-38.md` — Original report of empty html: output
- `framework-frame-ui-html-expand-empty-body.md` — Framework-side investigation
- `clean-compiler-html-block-resolution.md` — Resolution of parser routing (works, but output is corrupted)
- `fix-plugin-string-corruption.md` — Previously fixed string corruption (may have regressed)
- `compiler-plugin-version-mismatch-warning.md` — Enhancement to warn about stale plugin binaries
