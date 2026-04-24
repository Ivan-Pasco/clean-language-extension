Component: ALL (compiler + clean-server + frame.server plugin)
Issue Type: bug
Priority: critical
Source Component: Web Site Clean
Date: 2026-04-08
Status: RESOLVED — Root cause found and fixed in compiler

## RESOLUTION (April 8, 2026)

**The bug was NOT in `req.body()`, the server, or the plugin.** It was in the compiler's MIR codegen for string equality comparisons.

In `clean-language-compiler/src/codegen/mir_codegen.rs` line 4550, the `i32.eqz` instruction was applied to `NotEqual` instead of `Equal`. Since `string_compare` returns 0 for equal (like C's strcmp), the WASM `if` instruction (which branches on non-zero) needs `i32.eqz` to flip the result for `==` checks. The code had it backwards, making `==` behave like `!=`.

**Fix:** Swapped `MirBinaryOp::Ne` to `MirBinaryOp::Eq` in the i32.eqz condition.

**Impact:** ALL string equality/inequality comparisons in MIR-compiled WASM were inverted. This affected any code using `==` or `!=` with strings, not just `req.body()`.

**No changes needed in clean-server or frame.server plugin.** Both work correctly.

## Problem

`req.body()` and `req.query()` return empty strings in compiled WASM, despite clean-server correctly writing data to WASM memory. This has been confirmed across compiler v0.30.22 through v0.30.48, clean-server v1.8.11 and v1.9.0, on macOS and Linux.

**Every POST endpoint is broken. Most GET endpoints with query parameters are broken.**

## The complete data flow (what SHOULD happen)

```
1. HTTP request arrives at clean-server (Axum)
2. Axum extracts body/query/headers into RequestContext
3. WASM handler function is called
4. Handler calls req.body() [Clean Language dot-notation]
5. Compiler resolves req.body() → _req_body [bridge function]
6. Plugin expansion may wrap this in a route handler function
7. WASM executes: call $_req_body → gets i32 return value (string pointer)
8. clean-server's _req_body implementation:
   a. Reads body from RequestContext
   b. Calls write_string_to_caller() → writes length-prefixed string to WASM memory
   c. Returns i32 pointer to the written string
9. WASM stores pointer in local variable
10. WASM reads string from that pointer for subsequent operations
```

## What actually happens (proven with instrumented clean-server)

Steps 1-8c work correctly. Proven with eprintln! debug output:

```
[handle_request] POST /api/v1/reports body_len=244
[_req_body] has_context=true, body_len=244
[_req_body] memory[ptr..+8]=[244,0,0,0,123,34,114,101]   ← correct: len=244, data={"re...
[_req_body] __heap_ptr after write=62680                   ← heap advanced correctly
[_req_body] returning ptr=62432                            ← valid pointer returned
```

But the WASM code evaluates `body == ""` as TRUE. The string is in memory but the WASM code doesn't read it.

## Three components need to be analyzed simultaneously

### Component 1: Compiler (codegen)

**Repository:** `/Users/earcandy/Documents/Dev/Clean Language/clean-language-compiler/`

**What to check:**
1. How does the compiler generate code for `string body = req.body()`?
2. After `call $_req_body` returns an i32, does the generated WASM:
   - `local.set` it to the correct local variable slot?
   - Or does it drop the return value from the stack?
3. How does the compiler generate code for `string x = some_bridge_function()` vs `string x = some_bridge_function(arg1, arg2)`?
4. Is there a difference in codegen for functions with 0 params vs functions with params?

**How to debug:**
```bash
# Compile the minimal repro
cln compile --plugins -o /tmp/test.wasm /tmp/test-body.cln

# Decompile to WAT and inspect the handler function
wasm2wat /tmp/test.wasm > /tmp/test.wat

# Look at __route_handler_0 — specifically what happens after call $_req_body
grep -A 20 "route_handler" /tmp/test.wat
```

**Minimal repro for compiler team:**
```clean
plugins:
	frame.server
	frame.data

endpoints server:
	POST "/test" :
		return test_body()

	GET "/health" :
		return test_health()

functions:
	string test_body()
		string body = req.body()
		if body == ""
			return http.respond(200, "application/json", "{\"empty\":true}")
		return http.respond(200, "application/json", "{\"body_length\":" + body.length().toString() + "}")

	string test_health()
		return http.respond(200, "application/json", "{\"ok\":true}")
```

**Key question:** After `call $_req_body` executes and pushes an i32 onto the WASM stack, does the generated code store it to the local variable that represents `body`? Or does the local variable get initialized to empty string and never updated?

### Component 2: clean-server (runtime)

**Repository:** `/Users/earcandy/Documents/Dev/Clean Language/clean-server/`

**What to check:**
1. The `_req_body` host function — does it return the pointer correctly as an i32?
2. The `write_string_to_caller` utility — does it write the Clean string format (4-byte LE length prefix + UTF-8 data)?
3. Does the WASM memory actually contain the string at the returned pointer? (Already confirmed yes, but verify the format matches what the compiler expects to read)
4. The `__heap_ptr` global — after write_string_to_caller advances it, does the WASM code respect the new value?

**What works vs what doesn't (same server, same WASM):**

| Bridge function | Signature | Returns data? |
|---|---|---|
| `_db_query(ptr,len,ptr,len)` → i32 | 4 params | YES |
| `_http_respond(i32,ptr,len,ptr,len,ptr,len)` → i32 | 7 params | YES |
| `_json_encode(ptr,len)` → i32 | 2 params | YES |
| `_req_ip()` → i32 | 0 params | YES |
| `_req_body()` → i32 | 0 params | **NO** |
| `_req_query(ptr,len)` → i32 | 2 params | **PARTIAL** |
| `_req_header(ptr,len)` → i32 | 2 params | Untested |
| `_req_param(ptr,len)` → i32 | 2 params | Untested |

Note: `_req_ip()` works despite also being 0-param. So it's not simply "0-param functions fail."

### Component 3: frame.server plugin (code generation)

**Repository:** `~/.cleen/plugins/frame.server/` (or `/Users/earcandy/Documents/Dev/Clean Language/clean-framework/plugins/frame.server/`)

**What to check:**
1. The `expand_endpoints` function generates wrapper functions like `__route_handler_0()`. How does it wrap the user's `return test_body()` call?
2. Does the wrapper properly propagate the return value?
3. The generated `external:` block declares `_http_respond(integer status, string content_type, string body)` — the parameter name `status` is the same as common variable names. Could this cause shadowing?
4. What exact code does the plugin generate? The compiler's `[Plugin Debug]` output shows partial output — get the full generated code.

**How to get full plugin output:**
Add `printl(result)` before the `return result` in `expand_endpoints()`, rebuild the plugin, and compile. The full generated code will print to stdout.

## Cross-component interaction to investigate

The issue might be at the boundary between components:

1. **Plugin generates `external:` declarations** → Compiler registers bridge function signatures
2. **Plugin generates `__route_handler_N()` wrapper** → Compiler generates WASM for this wrapper
3. **Wrapper calls user function** → User function calls `req.body()` → Compiler resolves to `_req_body`
4. **`_req_body` executes in clean-server** → Returns i32 pointer
5. **Generated WASM receives the i32** → Should store to local, but doesn't use it

The bug could be:
- **Compiler:** Drops the return value from the stack after calling _req_body
- **Compiler:** Stores it to wrong local slot (offset error in plugin-expanded code)
- **Plugin:** The wrapper function interferes with the call chain
- **Server:** Returns the pointer in a way the WASM doesn't expect (e.g., via global instead of return value)
- **All three:** A combination — the plugin generates code that triggers a compiler edge case that the server's calling convention doesn't handle

## Fastest path to diagnosis

1. **Decompile the WASM** (`wasm2wat dist/server.wasm`) and find `__route_handler_0` (the POST /test handler). Trace what happens from `call $_req_body` to the `if body == ""` comparison. This will show exactly where the value gets lost.

2. **Compare with a working function.** `_req_ip()` works and also takes 0 params and returns a string. Find `_req_ip` usage in the WAT and compare the codegen pattern with `_req_body`. The difference is the bug.

3. **Compare with `_db_query()`.** This works and returns a string. Its codegen pattern is the "correct" one — `_req_body` should generate the same pattern for handling the return value.

## Files to examine

| Component | Key files |
|---|---|
| Compiler | `src/codegen/mod.rs`, `src/codegen/wasm_gen.rs`, `src/codegen/function_calls.rs` — how bridge function return values are handled |
| Compiler | `src/semantic/plugin_expansion.rs` or similar — how plugin output is parsed and integrated |
| Server | `src/bridge/request.rs` or similar — `_req_body`, `_req_query`, `_req_param` implementations |
| Server | `src/bridge/mod.rs` — how host functions are registered with wasmtime/wasmer |
| Plugin | `src/main.cln` — `expand_endpoints` function, specifically `__route_handler_N` generation |

## Environment

- Compiler: v0.30.48
- Framework: v2.10.9
- Server: v1.9.0 (latest commit with _http_route fix)
- All plugins at latest versions
- Website: 24 routes, compiles successfully, server loads WASM and registers all routes
- Tested on macOS arm64 (dev) and Linux x86_64 (production) — identical behavior
