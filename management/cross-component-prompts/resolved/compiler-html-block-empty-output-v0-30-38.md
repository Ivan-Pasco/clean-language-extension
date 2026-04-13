Component: clean-language-compiler + frame.ui plugin
Issue Type: bug
Priority: critical
Description: html: blocks compile without errors but produce empty strings at runtime in compiler v0.30.38 + frame.ui plugin v2.3.0
Context: Discovered while updating the Clean Language website to compiler v0.30.38. All html: blocks that previously produced HTML output now return empty strings at runtime. The WASM compiles successfully with --plugins, the server loads routes, but every function using an html: block returns empty string.

## Minimal reproduction

```clean
plugins:
    frame.httpserver
    frame.ui

endpoints server:
    GET "/" :
        return http.respond(200, "text/html", test_page())

functions:
    string test_page()
        string name = "World"
        html:
            <h1>Hello {name}</h1>
```

Compiles successfully. At runtime, `test_page()` returns empty string (content-length: 0).

Also tested with `html: var="result"` + explicit `return result` -- same empty result.

## What works

Plain string via `http.respond()` works correctly:
```clean
GET "/" :
    return http.respond(200, "text/html", "<h1>Hello World</h1>")
```
This returns `<h1>Hello World</h1>` as expected.

## What doesn't work

Any function using an `html:` block returns empty string, including:
- Implicit return (html: block as last expression)
- `html: var="result"` + `return result`
- html: blocks with `{var}` interpolation
- html: blocks with `{!var}` raw interpolation
- html: blocks with pure static HTML (no interpolation)

## Environment
- Compiler: v0.30.38
- Server: clean-server v1.8.11
- Plugin: frame.ui 2.3.0 (plugin.wasm 98417 bytes, updated Apr 2 20:36)
- Plugin: frame.httpserver 2.6.1
- Compilation succeeds with `cln compile --plugins` (no errors)

## Analysis

The `html:` block is handled by the frame.ui plugin's `expand_block` export at compile time. The plugin transforms the html: block into Clean code that the compiler then generates WASM for. Since the compiled WASM produces empty strings, either:

1. The plugin's expand_block is generating incorrect/empty expansion code for html: blocks
2. The compiler is not correctly processing the plugin's expansion output
3. The bridge function `_html_raw` or `_html_escape` (used by the expansion) is returning empty in clean-server

The fact that plain string concatenation + `http.respond()` works proves the server, compiler codegen, and string handling are all functional. The issue is isolated to the html: block expansion pipeline.

## Impact
All SSR pages on the website are broken (7 pages). The website cannot render any HTML content via html: blocks.

## Files affected
- Compiler: plugin expansion pipeline for html: blocks
- frame.ui plugin: expand_block function (plugin.wasm)
- Possibly clean-server: _html_raw / _html_escape bridge implementation
