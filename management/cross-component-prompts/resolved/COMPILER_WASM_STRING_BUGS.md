# Cross-Component Issue: WASM Code Generation Bugs for Host Functions

**Component**: clean-language-compiler
**Issue Type**: bug
**Priority**: HIGH
**Created**: 2026-01-26
**Source Component**: clean-framework (complete-demo example) via clean-server testing

---

## Summary

Server-side unit tests pass, but when Clean Language code is compiled to WASM and executed, two bugs appear:

1. **`_req_param()` returns empty string** - despite server tests showing correct param extraction
2. **String/JSON corruption** - UTF-8 errors at specific byte offsets in concatenated strings

Since server-side tests pass, the issue is likely in **how the compiler generates WASM code** that calls these host functions.

---

## Bug 1: `_req_param()` Returns Empty String

### Evidence That Server Code Works

All these clean-server tests PASS:
- `test_req_param_extracts_path_params` - `/test/:id` with `/test/hello123` returns `"hello123"`
- `test_multiple_path_params` - `/users/:userId/posts/:postId` extracts both params
- `test_router_api_users_id` - `/api/users/:id` with `/api/users/1` extracts `"1"`

### Evidence That Compiled WASM Fails

```clean
string __route_handler_2()
    string userId = _req_param("id")
    printl("User ID: " + userId)  // Prints empty string

    if userId == ""
        return "{\"ok\":false,\"error\":\"User ID required\"}"
```

When compiled and run with clean-server, `_req_param("id")` returns empty string.

### Investigation Areas for Compiler

1. **Function signature mismatch**: Check that `_req_param` is declared with correct types
   - Expected: `(name_ptr: i32, name_len: i32) -> i32` (returns string pointer)
   - Verify the WASM import declaration matches

2. **String argument passing**: Check how the compiler passes the string `"id"` to `_req_param`
   - Is the string literal stored in WASM memory correctly?
   - Is the pointer/length passed correctly to the host function?

3. **Return value handling**: Check how the compiler handles the returned string pointer
   - Does it correctly read the length-prefixed string from the returned pointer?
   - Is the return value being dropped or ignored?

4. **Generated WASM inspection**: Examine the WASM bytecode for:
   ```clean
   string userId = _req_param("id")
   ```
   - Verify the string "id" is stored in memory
   - Verify call instruction passes correct ptr/len
   - Verify return value is stored in local variable

### Debug Commands

```bash
# Compile with verbose output
cln compile test.cln -o test.wasm --verbose

# Inspect WASM imports
wasm-objdump -x test.wasm | grep _req_param

# Disassemble to see actual instructions
wasm-objdump -d test.wasm > test.wat
```

---

## Bug 2: String/JSON Corruption

### Symptoms

1. **UTF-8 Error**:
```
"Invalid UTF-8 in string: invalid utf-8 sequence of 1 bytes from index 29"
```

2. **Data Corruption**:
```json
{"ok":true,"count":1,"users":X   }
```
The `users` array shows `X` followed by spaces instead of JSON array data.

3. **Empty Value**:
```json
{"ok":true,"user":}
```

### Evidence That Server Code Works

- `_db_query` returns valid JSON (verified with debug logging)
- `write_string_to_caller` writes correct length prefix (verified)
- The corruption appears AFTER the database result is written

### Investigation Areas for Compiler

1. **String concatenation codegen**: The error appears when concatenating:
   ```clean
   resp = resp + json.dataToText(rows)
   ```

   Check that `string.concat` (or the + operator for strings):
   - Allocates enough memory for the result
   - Copies both source strings correctly
   - Returns a properly formatted length-prefixed string

2. **Memory management**: Check the bump allocator implementation:
   - Is `malloc` being called correctly from WASM?
   - Are there any issues with alignment?
   - Could subsequent allocations overwrite previous strings?

3. **`json.dataToText()` implementation**: This stdlib function may have bugs:
   - Does it properly escape special characters?
   - Does it handle nested objects/arrays correctly?
   - Does it allocate enough memory for the result?

4. **Large string handling**: The corruption happens with database results that could be large:
   - Are there buffer size limits being exceeded?
   - Is there truncation happening?

### Server Debug Logs Show

```
string.concat: ptr1=6828 ('Table created: '), ptr2=7344 ('0'), result_len=16
string.concat: output_ptr=7352, total_size=20
```

This shows string.concat IS being called, but the result may be wrong for larger strings.

---

## Test Case to Reproduce

```bash
# 1. Use this minimal test file
cat > /tmp/test_params.cln << 'EOF'
functions:
    string __route_handler_0()
        string id = _req_param("id")
        printl("Param id = '" + id + "'")
        return id

start()
    integer status = _http_route("GET", "/test/:id", 0)
    integer listen = _http_listen(3000)
EOF

# 2. Compile
cln compile /tmp/test_params.cln -o /tmp/test_params.wasm

# 3. Run server
clean-server /tmp/test_params.wasm --port 3002

# 4. Test
curl http://localhost:3002/test/hello123
# EXPECTED: "hello123"
# ACTUAL: "" (empty string)
```

---

## Files to Investigate in Compiler

1. **WASM code generation for function calls**:
   - `src/codegen/` - How host function imports are generated
   - How string arguments are passed (ptr + len)
   - How string return values are handled

2. **String literal storage**:
   - How string literals like `"id"` are stored in WASM data section
   - Memory layout for strings

3. **String concatenation operator**:
   - `+` operator for strings
   - Call to `string.concat` or `string_concat` host function

4. **Standard library `json` module**:
   - `json.dataToText()` implementation
   - `json.tryTextToData()` implementation

---

## Suggested Compiler Debugging

1. **Add WASM validation pass**:
   ```rust
   // After codegen, validate:
   // - All string function calls have correct signature
   // - All string returns are properly handled
   ```

2. **Generate debug info**:
   ```rust
   // In codegen for _req_param call:
   debug!("Generating call to _req_param:");
   debug!("  - String literal: {:?}", literal);
   debug!("  - Stored at ptr: {}", string_ptr);
   debug!("  - Length: {}", string_len);
   ```

3. **Inspect generated WASM**:
   Look for patterns like:
   ```wat
   ;; Expected for: string id = _req_param("id")
   i32.const 1234    ;; ptr to "id" in data section
   i32.const 2       ;; length of "id"
   call $env._req_param
   local.set $id     ;; store returned string ptr
   ```

---

## Priority

**HIGH** - These bugs prevent any route with path parameters from working, and cause data corruption in database-backed applications. The complete-demo example is non-functional due to these issues.

---

## Reference

- Server-side implementation: `clean-server/src/bridge.rs`
- Server tests (all pass): `clean-server/tests/host_functions_test.rs`
- Memory format: Length-prefixed strings `[4-byte LE length][UTF-8 bytes]`
