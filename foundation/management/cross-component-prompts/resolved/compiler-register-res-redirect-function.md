Component: clean-language-compiler
Issue Type: enhancement
Priority: medium
Description: The compiler's semantic analysis does not register `_res_redirect` as a known function. This means Clean Language source code that calls `_res_redirect("/login", 302)` fails validation with "Function '_res_redirect' not found". The server already implements this function in bridge.rs (Layer 3), and it's defined in `../platform-architecture/function-registry.toml`.

Context: Discovered while adding SSR companion file integration tests in clean-server. The guard pattern requires handlers to call `_res_redirect(url, status_code)` to trigger a redirect before returning. The server tests had to use hand-crafted WAT modules instead of Clean Language source to test this functionality.

Suggested Fix: Add `_res_redirect` to the function table in `src/semantic/mod.rs` alongside the other HTTP server functions (near line ~1206 where `_http_route` is registered):

```rust
// _res_redirect(url: string, status_code: integer) -> integer
self.function_table.insert(
    "_res_redirect".to_string(),
    vec![(
        vec![Type::String, Type::Integer],
        Type::Integer,
        2, // min_args
    )],
);
```

Also consider registering these related response functions from the function-registry.toml:
- `_res_set_header(name: string, value: string) -> integer` (boolean)
- `_res_status(code: integer)` (void)
- `_http_respond(status: integer, content_type: string, body: string) -> ptr`
- `_http_redirect(status: integer, url: string) -> ptr`

The WASM-level signatures (from function-registry.toml):
- `_res_redirect`: params = ["string", "i32"], returns = "boolean" → WASM: (i32 i32 i32) -> i32
- `_res_set_header`: params = ["string", "string"], returns = "boolean" → WASM: (i32 i32 i32 i32) -> i32
- `_http_redirect`: params = ["i32", "string"], returns = "ptr" → WASM: (i32 i32 i32) -> i32

Files Affected:
- `src/semantic/mod.rs` — add function table entries for response functions
- `src/codegen/` — ensure code generation emits correct WASM imports for these functions
