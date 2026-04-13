# String Comparison Bug - Deep Investigation

**Components**: clean-language-compiler AND clean-server
**Issue Type**: bug
**Priority**: critical
**Created**: 2026-01-27
**Status**: NEEDS INVESTIGATION

## Summary

String comparisons in Clean Language always return incorrect results:
- `"hello" == ""` returns TRUE (should be FALSE)
- `"hello" == "hello"` returns FALSE (should be TRUE)
- Length-based comparisons work correctly

## Test Results

```clean
string val = _req_param("id")  // val = "hello"

val == ""       // TRUE  - WRONG!
val == "hello"  // FALSE - WRONG!
val.length() == 0  // FALSE - CORRECT
```

## Architecture Analysis

### WASM Structure
The compiled WASM:
1. Imports `string_compare` from `env` module
2. Exports internal `string_compare` function (func 60)

```wat
(import "env" "string_compare" ...)
(export "string_compare" (func 60))
```

### Server Implementation
Location: `clean-server/host-bridge/src/wasm_linker/string_ops.rs`

```rust
linker.func_wrap(
    "env",
    "string_compare",
    |mut caller: Caller<'_, S>, str1_ptr: i32, str2_ptr: i32| -> i32 {
        let s1 = read_string_from_caller(&mut caller, str1_ptr).unwrap_or_default();
        let s2 = read_string_from_caller(&mut caller, str2_ptr).unwrap_or_default();
        if s1 == s2 { 1 } else { 0 }
    },
)?;
```

The server uses length-prefixed strings (4-byte little-endian length + UTF-8 data).

## Potential Issues

### Issue 1: Compiler Not Calling string_compare
The compiler might be generating inline comparison code instead of calling `string_compare`.

**Investigation**: Check MIR or codegen for string `==` operator handling.

Files to check:
- `src/codegen/mir_codegen.rs`
- `src/codegen/operators.rs`
- `src/mir/` - MIR representation of comparisons

### Issue 2: Wrong Pointers Being Passed
The compiler might be passing incorrect pointers to `string_compare`.

**Investigation**: Add debug logging to `string_compare` in server:
```rust
debug!("string_compare: ptr1={}, ptr2={}", str1_ptr, str2_ptr);
debug!("string_compare: s1='{}' (len={}), s2='{}' (len={})", s1, s1.len(), s2, s2.len());
```

### Issue 3: Export/Import Conflict
The WASM exports its own `string_compare` (func 60) which might shadow the imported one.

**Investigation**: Check if the internal function is being called instead of the host function.

### Issue 4: String Literal Representation
Empty string literals might have a special representation that doesn't match runtime strings.

**Investigation**: Check how string literals are stored in the data section vs runtime strings.

## Reproduction Steps

```bash
# Create test file
cat > /tmp/str-test.cln << 'EOF'
plugins:
    frame.httpserver

functions:
    string __route_handler_0()
        string val = _req_param("id")
        printl("val = '" + val + "'")

        if val == ""
            printl("val == \"\" is TRUE")
        else
            printl("val == \"\" is FALSE")

        if val == "hello"
            printl("val == \"hello\" is TRUE")
        else
            printl("val == \"hello\" is FALSE")

        return "{\"done\":true}"

start()
    integer s = _http_route("GET", "/t/:id", 0)
EOF

# Compile
cln compile /tmp/str-test.cln -o /tmp/str-test.wasm

# Run and test
cleen server run /tmp/str-test.wasm --port 3002 &
sleep 3
curl http://localhost:3002/t/hello
```

## Expected vs Actual

| Expression | Expected | Actual |
|------------|----------|--------|
| `"hello" == ""` | FALSE | TRUE |
| `"hello" == "hello"` | TRUE | FALSE |
| `"hello".length() == 0` | FALSE | FALSE |
| `"hello".length() == 5` | TRUE | TRUE |

## Next Steps

### For Compiler Team:
1. Trace how `==` operator on strings is compiled
2. Verify `string_compare` is being called (not inline comparison)
3. Check what pointers are passed to `string_compare`
4. Verify string literal storage in data section

### For Server Team:
1. Add detailed debug logging to `string_compare`
2. Verify the function is actually being called
3. Check if exported func 60 is shadowing the import
4. Verify `read_string_from_caller` works with both literals and runtime strings

## Debug Logging to Add

### In clean-server (string_ops.rs):
```rust
linker.func_wrap(
    "env",
    "string_compare",
    |mut caller: Caller<'_, S>, str1_ptr: i32, str2_ptr: i32| -> i32 {
        error!("string_compare CALLED: ptr1={}, ptr2={}", str1_ptr, str2_ptr);

        let s1 = read_string_from_caller(&mut caller, str1_ptr).unwrap_or_default();
        let s2 = read_string_from_caller(&mut caller, str2_ptr).unwrap_or_default();

        error!("string_compare: s1='{}' (len={})", s1, s1.len());
        error!("string_compare: s2='{}' (len={})", s2, s2.len());

        let result = if s1 == s2 { 1 } else { 0 };
        error!("string_compare: result={}", result);
        result
    },
)?;
```

### In clean-language-compiler:
Add debug output showing what code is generated for string `==` comparisons.
