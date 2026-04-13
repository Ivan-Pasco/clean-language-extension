# Cross-Component Prompt: Fix Plugin Runtime String Corruption

**Component:** clean-language-compiler
**Issue Type:** bug
**Priority:** high
**Created:** 2026-01-24
**Created By:** clean-framework (frame.httpserver plugin development)
**Status:** ✅ FIXED in v0.30.3 and v0.30.4

## Resolution

**v0.30.3** (2026-01-24):
- Added 14 missing string host functions including `string.substring`
- Added 7 underscore-style aliases for WASM naming compatibility

**v0.30.4** (2026-01-24):
- Added dot-notation trim functions: `string.trim`, `string.trimStart`, `string.trimEnd`
- Added bounds checking to prevent crashes on invalid pointers
- Both underscore and dot notation now supported for all string operations

## Description

The plugin runtime has a memory corruption bug specifically in the `trim()` string method. When `trim()` is called on a substring result, it returns garbage data (all spaces) instead of the trimmed content.

**Key Finding:** Removing `trim()` from the chain fixes the corruption. The following works correctly:
```clean
string raw_code = after_handle.substring(0, end_pos)
return "\t\t" + raw_code.replace("\n", "\n\t\t")  // Works!
```

But this corrupts:
```clean
string raw_code = after_handle.substring(0, end_pos).trim()  // Corrupts!
return "\t\t" + raw_code.replace("\n", "\n\t\t")
```

## Context

While developing the `frame.httpserver` plugin for the Frame Framework, I needed to extract handler code from endpoint definitions. The plugin correctly finds and parses the text, but when performing string transformations, the data gets corrupted.

## Reproduction Steps

1. Compile and use this plugin code:

```clean
string extract_handle_code(string endpoint_body)
    integer handle_pos = endpoint_body.indexOf("handle:")
    if handle_pos == -1
        return ""

    string after_handle = endpoint_body.substring(handle_pos + 7, endpoint_body.length())

    // Find end position
    integer end_pos = after_handle.length()
    integer next_get = after_handle.indexOf("GET \"")
    if next_get >= 0 and next_get < end_pos
        end_pos = next_get

    // This line produces corrupted output:
    string raw_code = after_handle.substring(0, end_pos).trim()

    // The replace receives garbage (all spaces) instead of the actual text
    return "\t\t" + raw_code.replace("\n", "\n\t\t")
```

2. Run the plugin on input containing:
```
handle:
    if password != password_confirm:
        return badRequest("Passwords do not match")
    return json:
        success: true

GET "/next/endpoint":
```

3. Observe debug output showing:
   - Correct text found: `if password != password_confirm:...`
   - But `string.replace` receives: `'                    ...'` (all spaces)

## Debug Output Evidence

```
[Plugin]
if password != password_confirm:
return badRequest ( "Passwords do not match" )
return json:
success: true
message: "Registration successful"

[Plugin Debug] string.replace called: source='

', search='
', replace='
		'
```

The `[Plugin]` output shows the correct text was found, but by the time `replace()` is called, the string has been corrupted to all spaces.

## Suspected Cause

The issue appears to be in how the plugin runtime handles chained string method calls or how it manages memory for intermediate string results. Possible locations:

1. **`src/plugins/wasm_adapter.rs`** - The host functions for string operations
2. **`src/plugins/mod.rs`** - Plugin state management
3. **Memory allocation** - The bump allocator might be reusing memory incorrectly

Specific functions to investigate:
- `string_substring` host function
- `string_trim` host function
- `string_replace` host function
- How return values are passed back to WASM

## Files Affected

- `/Users/earcandy/Documents/Dev/Clean Language/clean-language-compiler/src/plugins/wasm_adapter.rs`
- `/Users/earcandy/Documents/Dev/Clean Language/clean-language-compiler/src/plugins/mod.rs`

## Workarounds Tried

1. **Avoiding chained calls** - Same issue
2. **Using separate variables** - Same issue
3. **Simpler replace patterns** - Same issue
4. **Character-by-character processing** - Causes WASM crash

## Suggested Investigation

1. Add debug logging to `string_substring`, `string_trim`, and `string_replace` to trace:
   - Input pointer and length
   - Output pointer and length
   - Actual bytes at those memory locations

2. Check if the bump allocator is:
   - Properly tracking allocated regions
   - Not reusing memory that's still in use
   - Correctly handling the Clean string format `[4-byte length][UTF-8 data]`

3. Verify that when a host function returns a string pointer:
   - The pointer points to valid, allocated memory
   - The memory isn't being overwritten before WASM reads it
   - The string format (length prefix) is correct

## Test Case

Create a minimal test in `tests/plugin_string_test.rs`:

```rust
#[test]
fn test_chained_string_operations() {
    let plugin_code = r#"
functions:
    string test()
        string input = "hello\nworld\ntest"
        string sub = input.substring(0, 11)  // "hello\nworld"
        string trimmed = sub.trim()
        string result = trimmed.replace("\n", " ")
        return result

start()
    printl(test())
"#;

    // Compile and run, verify output is "hello world" not garbage
}
```

## Expected Outcome

After the fix:
1. Chained string operations should preserve data integrity
2. The frame.httpserver plugin should be able to extract handler code
3. Plugin output should contain the actual handler code, not stubs

## Impact

This bug blocks:
- Full handler code extraction in frame.httpserver plugin
- Any plugin that needs complex string manipulation
- Proper DSL expansion for Frame Framework features
