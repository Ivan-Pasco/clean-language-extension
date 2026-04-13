# Compiler: String Comparison Code Generation Bug

**Component**: clean-language-compiler
**Issue Type**: bug
**Priority**: critical
**Created**: 2026-01-27

## Problem

String `==` comparisons always return wrong results:
- `"hello" == ""` → TRUE (should be FALSE)
- `"hello" == "hello"` → FALSE (should be TRUE)

## Investigation Required

### 1. Check How String == Is Compiled

Find the code that handles the `==` operator for string types.

Files to check:
- `src/codegen/mir_codegen.rs`
- `src/codegen/operators.rs` (if exists)
- `src/mir/` - MIR representation

Questions to answer:
- Is the compiler calling `string_compare` host function?
- Or is it generating inline comparison code?
- What arguments are passed to the comparison?

### 2. Check String Literal Storage

How are string literals like `""` and `"hello"` stored?

- Are they in the data section?
- What format? (length-prefixed? null-terminated?)
- Are the pointers correct?

### 3. Check WASM Output

The compiled WASM shows:
```wat
(import "env" "string_compare" ...)
(export "string_compare" (func 60))
```

There's both an import AND an export of `string_compare`. Is the internal func 60 shadowing the imported host function?

### 4. Trace a Simple Comparison

For this code:
```clean
string val = "hello"
if val == ""
    printl("empty")
```

What WASM instructions are generated for `val == ""`?

Expected:
1. Get pointer to `val`
2. Get pointer to empty string literal
3. Call `string_compare`
4. Branch based on result

## Debugging Steps

1. Add logging to codegen when generating string comparisons:
```rust
debug!("Generating string comparison: {:?} == {:?}", left, right);
```

2. Inspect the generated WASM for a simple comparison

3. Check if `string_compare` is being called or if something else is happening

## Test Case

```clean
// Minimal test
functions:
    integer test()
        string a = "hello"
        string b = ""
        if a == b
            return 1
        return 0

start()
    integer result = test()
    printl("Result: " + result.toString())
```

Expected output: `Result: 0`
Actual output: `Result: 1`
