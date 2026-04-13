Component: clean-framework/plugins/frame.ui
Issue Type: bug
Priority: critical
Description: frame.ui plugin expand_block converts single-quoted HTML attributes to double quotes, causing compiler tokenizer failure
Context: Discovered while updating the Clean Language website to compiler v0.30.39. The html: block expansion pipeline now works (the plugin generates string concatenation code), but the plugin converts single-quoted HTML attributes to double-quoted ones during expansion. Since the expanded code wraps HTML content in double-quoted Clean strings, the inner double quotes create invalid escape sequences that the compiler's tokenizer rejects.

## Reproduction

Source file with single-quoted HTML attributes:
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
            <div class='container'>
                <h1 class='title'>Hello</h1>
            </div>
```

File hex dump confirms source uses `0x27` (single quote):
```
class='container'
```

## What the plugin generates (observed in error output)

```clean
string __html = ""
    __html = __html + "<div class=\"container\">..."
```

The plugin converts `class='container'` to `class=\"container\"` — wrapping the value in double quotes and escaping them. But the compiler tokenizer doesn't support `\"` inside strings, causing:

```
error[E001]: Failed to tokenize plugin output: Invalid character '\' at <plugin-output>:9:84
```

## Expected behavior

The plugin should preserve single quotes in the expansion:
```clean
string __html = ""
    __html = __html + "<div class='container'>"
```

Single quotes inside double-quoted Clean strings are valid and don't need escaping.

## Environment
- Compiler: v0.30.39
- Plugin: frame.ui 2.3.0 (plugin.wasm 98417 bytes)
- All 8 page files in the website are affected (components.cln, home.cln, get_started.cln, syntax.cln, modules.cln, docs.cln, errors_dashboard.cln, errors_detail.cln)

## Impact
No html: block can compile if it contains any HTML attributes, since virtually all HTML uses quoted attribute values. This blocks all SSR page rendering.

## Files affected
- `clean-framework/plugins/frame.ui/src/` — the `expand_block` function that processes html: blocks
- The expansion should output single-quoted HTML attributes as-is, not convert them to escaped double quotes
