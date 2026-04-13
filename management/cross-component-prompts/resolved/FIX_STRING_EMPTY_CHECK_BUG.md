# Cross-Component Issue: String Empty Check Returns Wrong Result

**Component:** clean-language-compiler
**Issue Type:** bug
**Priority:** critical
**Reported From:** clean-server v1.7.10

## Description

String empty checking returns TRUE for non-empty strings.

**Observed behavior:**
```
Value: 'hello'
EMPTY CHECK: TRUE   ← Should be FALSE
```

When checking if a string is empty, the check incorrectly returns TRUE even when the string contains data ('hello').

## Context

This was discovered while testing with compiler v0.30.11 and server v1.7.10. The server correctly implements all string host functions, but the empty check logic appears to be generated incorrectly by the compiler.

## Technical Analysis

1. `string_length` is implemented natively in the compiler (not as a host function)
2. Empty checks in Clean Language use either:
   - String comparison: `if value == ""`
   - Length check: `if value.length == 0` or `if value.isEmpty()`
3. The server's string format uses 4-byte little-endian length prefix + UTF-8 content
4. The bug suggests the compiler is either:
   - Reading length from wrong memory offset
   - Not properly handling the length prefix
   - Generating incorrect pointer arithmetic for isEmpty

## Files Likely Affected

Look in `src/codegen/` for:
- Native stdlib implementations (`native_stdlib`)
- String length/isEmpty code generation
- String comparison code generation

Also check `src/semantic/` for type inference issues that might affect string operations.

## Suggested Fix

1. Verify `string_length` native implementation reads the 4-byte length prefix correctly
2. Check isEmpty/empty comparison generates correct WASM instructions
3. Ensure pointer arithmetic accounts for the STRING_LENGTH_PREFIX_SIZE (4 bytes)

## String Memory Format Reference

From server's host-bridge:
```rust
/// Clean string format: [4-byte little-endian length][UTF-8 bytes]
pub const STRING_LENGTH_PREFIX_SIZE: usize = 4;
```

To read a string's length:
```rust
let len_bytes: [u8; 4] = data[ptr..ptr + 4].try_into().ok()?;
let len = u32::from_le_bytes(len_bytes) as usize;
```

## Test Case

Create a test that verifies:
```clean
functions:
    boolean test_empty_check()
        string value = "hello"
        if value == ""
            return true   // BUG: This path is being taken
        return false      // EXPECTED: This should be returned

start()
    boolean result = test_empty_check()
    if result == true
        printl("EMPTY CHECK: TRUE")
    else
        printl("EMPTY CHECK: FALSE")
```

Expected output: `EMPTY CHECK: FALSE`
Actual output: `EMPTY CHECK: TRUE`
