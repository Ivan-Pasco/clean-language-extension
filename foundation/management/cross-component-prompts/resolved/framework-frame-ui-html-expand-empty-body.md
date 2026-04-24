Component: clean-framework (frame.ui plugin)
Issue Type: bug
Priority: critical
Description: frame.ui plugin's `expand` function ignores the body parameter for `html:` blocks inside function bodies, returning `string __html = ""` instead of the actual HTML content.

## Root Cause Analysis

The compiler correctly passes the HTML content to the frame.ui plugin's `expand` WASM function. The plugin receives three string pointers: (block_name, attributes, body). However, the plugin's expand function returns:

```
string __html = ""
return __html
```

Instead of something like:

```
string __html = "<h1>Hello World</h1>"
return __html
```

## Reproduction

Compile this file with `cln compile test.cln -o test.wasm --plugins`:

```clean
plugins:
    frame.ui

start:
    print(test_page())

functions:
    string test_page()
        html:
            <h1>Hello World</h1>
```

The compiler passes `block.content = "<h1>Hello World</h1>"` (20 bytes) to the plugin, confirmed by debug output: `[Plugin Debug] write_clean_string: len=20`. The plugin returns 33 chars: `string __html = ""\nreturn __html`.

## Environment
- Compiler: v0.30.38
- frame.ui: v2.6.1
- Plugin WASM: `~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm` (94,592 bytes)
- Also reproduced with `~/.cleen/plugins/frame.ui/plugin.wasm` (root-level copy)

## How the compiler passes the body

In `src/plugins/wasm_adapter.rs`, `call_expand()`:
1. Writes the body string to WASM memory using `find_or_write_string()` (Clean string format: 4-byte length prefix + content)
2. Calls the plugin's expand function with `(block_name_ptr, attributes_ptr, body_ptr)`
3. Reads the result string from the returned pointer

The string writing uses `write_clean_string()` which stores length (u32 LE) followed by the raw bytes. The plugin's debug output confirms the write succeeds. The issue is in how the plugin's expand function reads or processes this body parameter.

## Impact
All SSR pages on the website are broken — every `html:` block inside a function body produces empty strings at runtime (content-length: 0).

## Suggested Investigation
1. Check the frame.ui plugin's expand function (in its Clean source or WASM)
2. Verify how it reads the third parameter (body pointer)
3. The plugin may be reading from the wrong memory offset, or its string reading logic may not match the compiler's string writing format
4. Compare with how the plugin handles top-level blocks (component:, screen:) which may work differently

## Files Affected
- `~/.cleen/plugins/frame.ui/` — plugin source and WASM
- Plugin's expand function implementation
