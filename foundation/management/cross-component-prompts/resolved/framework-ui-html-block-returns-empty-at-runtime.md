Component: clean-framework (frame.ui plugin) + clean-language-compiler
Issue Type: bug
Priority: critical
Source Component: Web Site Clean
Date: 2026-04-09

## Summary

`html:` blocks compile successfully but return empty string at runtime. All 7 HTML pages on cleanlanguage.dev render 0 bytes because every page function uses `html:` blocks.

## Reproduction

```clean
plugins:
	frame.server
	frame.data
	frame.ui

functions:
	string test_page()
		string title = "Hello"
		html:
			<html>
			<body>
			<h1>{title}</h1>
			</body>
			</html>

endpoints server:
	GET "/" :
		return http.respond(200, "text/html", test_page())
```

Compile: `cln compile --plugins -o test.wasm test.cln` — compiles with 0 errors.
Run: `clean-server test.wasm --port 3001 --database "..."`
Test: `curl http://localhost:3001/` — returns 200 with **0 bytes**.

## Proof that the issue is html: blocks specifically

Same code but with string return instead of html: block:

```clean
functions:
	string test_page()
		return "<html><body><h1>Hello</h1></body></html>"
```

This returns the HTML correctly. Only `html:` blocks are broken.

## Environment

- Compiler: v0.30.49
- Framework: v2.10.9 (frame.ui v2.6.1)
- Server: clean-server v1.9.0
- All routes register correctly (24 routes), all API endpoints work, only html: block rendering is broken

## Impact

All 7 HTML pages on cleanlanguage.dev (homepage, get-started, syntax, modules, docs, errors dashboard, errors detail) return 0 bytes. The error reporting API works perfectly — only page rendering is affected.

## Bug report ID

Submitted via MCP report_error: `48e6939b-af93-4505-a566-09e4abb2b500`

## Resolution (2026-04-09)

**Root Cause:** The plugin's `strip_block_indent()` function (frame.ui WASM) returns empty string for ANY input due to a WASM codegen bug affecting local variable scoping in compiled Clean code. The function uses a two-pass pattern (`remaining = content`, modify `remaining`, then `remaining = content` again) that breaks in WASM.

Individual string operations (`indexOf`, `substring`, `trim`, `length`) all work correctly in WASM. The `html_block_to_code()` function also works correctly when called directly. Only `strip_block_indent()` is broken.

**Fix Applied:** In `clean-language-compiler/src/plugins/wasm_adapter.rs`:
1. For `html:` blocks, the compiler now bypasses `expand_block` and calls `html_block_to_code` directly (which works correctly)
2. The compiler pre-strips indentation in Rust via `strip_common_indent()` before passing the body to the plugin
3. The compiler wraps the result in the same `string __html = ""\n{code}\nreturn __html\n` template that `expand_html_block` uses
4. Also fixed `find_or_write_string` scan range from 8192 to 32768 to cover large plugin data sections

**Remaining work:** The underlying WASM codegen bug that causes `strip_block_indent` to fail should be investigated and fixed in the compiler's code generator for a permanent solution.
