Component: clean-framework
Issue Type: bug
Priority: high
Description: frame.data plugin expand_block may not be reading the attributes parameter correctly

## Context

The compiler passes 3 string parameters to `expand_block(block_name, attributes, body)`:
- `block_name` = "data"
- `attributes` = "User" (the model name from `data User`)
- `body` = the field definitions

The compiler side has been verified correct (wasm_adapter.rs lines 2374-2405).

## What to Check

In `plugins/frame.data/src/main.cln`, verify the `expand_block` function:

1. Has the correct 3-parameter signature: `string expand_block(string block_name, string attributes, string body)`
2. Uses `attributes` as the model name (not parsing it from body)
3. Doesn't assume only 2 parameters

## Additional Fix Now Available

The compiler now preserves class definitions in plugin output (commit 873be75). So the plugin can return full class definitions:

```clean
class User
    functions:
        boolean save()
            ...
```

And the compiler will correctly parse and include them in the program AST. Previously, classes were silently dropped.

## Files Affected
- `plugins/frame.data/src/main.cln` - expand_block function signature and parameter usage
