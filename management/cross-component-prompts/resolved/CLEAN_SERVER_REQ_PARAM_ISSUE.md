# Cross-Component Issue: _req_param Returns Empty String at Runtime

**Component:** clean-server
**Issue Type:** bug
**Priority:** HIGH
**Date Discovered:** 2026-01-26
**Discovered By:** clean-language-compiler investigation
**Reference:** COMPILER_WASM_STRING_BUGS.md

---

## Summary

After thorough investigation of the compiler's WASM code generation, the generated code is **CORRECT**. The issue is on the **server-side** when handling `_req_param` calls from WASM.

---

## Compiler Investigation Results (VERIFIED CORRECT)

### 1. String Literal Storage ✅
String "id" is correctly stored in WASM data section at offset 4096:
- Format: `[4-byte LE length][content]`
- Actual: `[02 00 00 00][69 64]` = length 2, content "id"

### 2. Wrapper Function Registration ✅
```
raw_func_index=39 (raw _req_param import)
wrapper_index=334 (_req_param_wrapper)
function_map["_req_param"] = 334 (points to wrapper)
```

### 3. Wrapper Implementation ✅
The wrapper at index 334 correctly:
```wasm
LocalGet 0           ;; Get string pointer (4096)
I32Const 4           ;; Constant 4
I32Add               ;; content_ptr = 4096 + 4 = 4100
LocalGet 0           ;; Get string pointer again
I32Load              ;; Load length from ptr (loads 2 from offset 4096)
Call 39              ;; Call raw _req_param with (4100, 2)
End                  ;; Return result
```

### 4. testHandler Implementation ✅
```wasm
I32Const 4096        ;; String "id" pointer
LocalSet 0           ;; Store in local 0
LocalGet 0           ;; Get string pointer
Call 334             ;; Call wrapper
LocalSet 1           ;; Store return value
LocalGet 1           ;; Get return value
Return               ;; Return it
```

### 5. Import Declaration ✅
Raw import `_req_param` has correct signature: `(i32, i32) -> i32`

---

## Server-Side Investigation Needed

Since the compiler generates correct WASM, the issue is in one of these server-side areas:

### 1. Request Context During WASM Execution
When the WASM route handler is invoked:
- Is the request context (RequestContext/CurrentRequest) properly set up?
- Can the host function access the current request?
- Is there a thread-local or async context issue?

### 2. Host Function Implementation
In `clean-server/src/bridge.rs`, the `_req_param` host function:
- Does it have access to the current request context?
- How does it extract path parameters from the route match?
- Is the route match result being passed correctly?

### 3. Return Value Writing
When `_req_param` returns a string:
- How is memory allocated in WASM for the result?
- Is `write_string_to_caller` being called correctly?
- Is the returned pointer valid?

---

## Debugging Steps

### Step 1: Add Debug Logging to _req_param Host Function
```rust
// In clean-server/src/bridge.rs
fn _req_param(caller: &mut Caller<...>, name_ptr: i32, name_len: i32) -> i32 {
    // Read the param name from WASM memory
    let memory = caller.get_export("memory")...;
    let name_bytes = memory.data(&caller)[name_ptr as usize..(name_ptr + name_len) as usize];
    let name = std::str::from_utf8(&name_bytes)?;

    tracing::debug!("_req_param called with name='{}' (ptr={}, len={})", name, name_ptr, name_len);

    // Get the current request context
    let request_context = ???; // How is this accessed?

    tracing::debug!("Request context: {:?}", request_context);
    tracing::debug!("Path params: {:?}", request_context.path_params);

    // ... rest of implementation
}
```

### Step 2: Verify Request Context Setup
When a route handler is invoked:
1. Is the request context set before calling the WASM function?
2. Is it accessible to host functions during the WASM call?
3. Is it thread-safe (if using async)?

### Step 3: Test with Simple Route
Create a minimal test:
```clean
functions:
    string handler()
        string id = _req_param("id")
        printl("Param: " + id)
        return id

start()
    _http_route("GET", "/test/:id", 0)
    _http_listen(3000)
```

Then test with:
```bash
curl http://localhost:3000/test/hello123
```

Expected: "hello123"
Actual: "" (empty string)

---

## Server Tests vs Runtime

**Why server tests pass but runtime fails:**

Server tests likely:
1. Mock the request context directly
2. Don't go through the full WASM execution path
3. Test the Rust function in isolation

Runtime execution:
1. WASM calls host function
2. Host function needs to access request context
3. Context might not be properly passed or accessible

---

## Files to Investigate

1. `clean-server/src/bridge.rs` - Host function implementations
2. `clean-server/src/server.rs` - Request handling and context setup
3. `clean-server/src/wasm_runtime.rs` - WASM execution setup
4. How `RequestContext` is passed to WASM execution
5. Thread-local or async context handling

---

## Expected Fix Location

The fix is likely needed in:
1. How the request context is stored when invoking a WASM handler
2. How the `_req_param` host function accesses the request context
3. Possibly a missing step in setting up the context before WASM execution

---

## Verification After Fix

After fixing, verify:
1. `_req_param("id")` returns the correct value
2. Multiple params work: `_req_param("userId")`, `_req_param("postId")`
3. Server tests still pass
4. Integration tests with actual WASM execution pass
