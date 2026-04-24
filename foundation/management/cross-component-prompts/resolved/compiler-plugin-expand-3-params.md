Component: clean-language-compiler
Issue Type: bug
Priority: critical
Description: Plugin expand_block only receives 2 of 3 string parameters — attributes parameter is never written to WASM memory

## Evidence

Compiling with `--verbose` shows only 2 `write_clean_string` calls for a 3-parameter function:

```
[Plugin Debug] write_clean_string: len=4, ptr=524288   → "data" (block_name)
[Plugin Debug] write_clean_string: len=77, ptr=524296  → body content (fields)
```

The `attributes` parameter ("User" from `data User`) is never written.

## Impact

The plugin function `expand_block(string block_name, string attributes, string body)` receives:
- `block_name` = "data" (correct)
- `attributes` = body content, 77 chars (WRONG — should be "User")
- `body` = empty/uninitialized (WRONG — should be the field content)

This causes `expand_data_model` to receive the field body as the model name and an empty string as the body, so no fields are parsed and the class is generated without field declarations.

## Reproduction

```bash
mkdir -p /tmp/test-data && cd /tmp/test-data
cat > app.cln << 'EOF'
plugins:
    frame.data

data User
    integer id : pk, auto
    string email : unique
    string name

start:
    printl("test")
EOF

cln compile app.cln -o app.wasm --verbose 2>&1 | grep write_clean_string
```

Expected: 3 `write_clean_string` calls (block_name="data", attributes="User", body="integer id...")
Actual: 2 `write_clean_string` calls (block_name="data", body="integer id...")

## Where to Fix

The WASM adapter code that calls plugin `expand_block`. Look in `src/plugins/wasm_adapter.rs` around the function that prepares parameters for the expand call. Three strings need to be written to WASM memory:

1. `block_name` — the block keyword (e.g., "data", "endpoints")
2. `attributes` — the text after the keyword on the same line (e.g., "User" from `data User`)
3. `body` — the indented body content

The attributes parameter is being skipped or merged with the body.

## Previous Prompt

`framework-data-plugin-attributes-param.md` stated "compiler side verified correct (wasm_adapter.rs lines 2374-2405)" but the verbose debug output proves the attributes string is NOT being written to WASM memory. The verification was incorrect.

## Files Affected
- `src/plugins/wasm_adapter.rs` — expand_block parameter passing
