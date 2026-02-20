# Clean Language Execution Layers

> **Authoritative source for function signatures:** [`function-registry.toml`](function-registry.toml)
> All Layer 2 and Layer 3 host function signatures are defined in the shared registry and validated by automated spec compliance tests.

This document defines the authoritative execution layer architecture for the Clean Language platform. **All components MUST reference this document to ensure correct function placement and execution.**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 5: APPLICATION LAYER                            │
│                     (clean-framework, user applications)                     │
│         High-level abstractions: Components, Routing, State Management       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 4: PLUGIN LAYER                                 │
│                          (plugin.toml declarations)                          │
│         Domain-specific extensions: Custom bridges, third-party integrations │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 3: SERVER EXTENSIONS                            │
│                    (clean-server, clean-node-server)                         │
│         Server-only functions: HTTP routing, request context, sessions       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 2: HOST BRIDGE                                  │
│                    (portable across ALL runtimes)                            │
│         I/O operations: Console, File, HTTP Client, Database, Crypto         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: PURE WASM                                    │
│                    (executed by WASM runtime itself)                         │
│         Pure computation: Math, type conversions, memory operations          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 0: COMPILER                                     │
│                    (clean-language-compiler)                                 │
│         Code generation: Parsing, semantic analysis, WASM emission           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 0: Compiler (clean-language-compiler)

**Purpose:** Transforms Clean Language source code (.cln) into WebAssembly modules (.wasm).

**Responsibilities:**
- Parsing Clean Language syntax
- Semantic analysis and type checking
- WASM code generation
- Import declaration generation (NOT implementation)
- Built-in function registration (compiler-level only)

**What BELONGS in the compiler:**
| Category | Functions | Reason |
|----------|-----------|--------|
| Language built-ins | `print`, `printl`, `input` | Core I/O always available |
| Math operations | `abs`, `sqrt`, `pow`, `sin`, `cos`, etc. | Pure computation, can be WASM intrinsics |
| Type conversions | `toString`, `toInteger`, `toNumber` | Compiler-level type operations |
| Class structures | `Math.*`, `String.*`, `Integer.*` | Language namespace structures |
| Pure WASM ops | `json.parse`, `json.stringify` | Implemented entirely in WASM |

**What DOES NOT belong in the compiler:**
| Category | Functions | Where It Belongs |
|----------|-----------|------------------|
| File I/O | `file.read`, `file.write`, `file.exists` | Layer 2 (Host Bridge) |
| HTTP Client | `http.get`, `http.post`, `http.put` | Layer 2 (Host Bridge) |
| HTTP Server | `_http_route`, `_http_listen` | Layer 3 (Server Extensions) |
| Database | `_db_query`, `_db_execute` | Layer 2 (Host Bridge) |
| Request Context | `_req_param`, `_req_query`, `_req_body` | Layer 3 (Server Extensions) |
| Session/Auth | `_auth_get_session`, `_auth_require_role` | Layer 3 (Server Extensions) |
| Crypto | `_crypto_hash_password`, `_crypto_hash_sha256` | Layer 2 (Host Bridge) |

**Component:** `clean-language-compiler/`

---

## Layer 1: Pure WASM (WASM Runtime)

**Purpose:** Execute pure computational operations within the WASM sandbox.

**Responsibilities:**
- Mathematical computations
- Memory allocation and management
- Type conversions
- String manipulation (pure operations)
- JSON parsing/serialization
- Array operations

**Functions executed at this layer:**

```
┌────────────────────────────────────────────────────────────────┐
│                    PURE WASM OPERATIONS                         │
├────────────────────────────────────────────────────────────────┤
│ MATH (WASM intrinsics)                                          │
│   f64.abs, f64.sqrt, f64.ceil, f64.floor, f64.trunc            │
│   f64.nearest, f64.min, f64.max, f64.copysign                  │
│   f64.add, f64.sub, f64.mul, f64.div                           │
│   i32.add, i32.sub, i32.mul, i32.div_s, i32.rem_s              │
│   i64.add, i64.sub, i64.mul, i64.div_s, i64.rem_s              │
├────────────────────────────────────────────────────────────────┤
│ MEMORY                                                          │
│   memory.grow, memory.size                                      │
│   i32.load, i32.store, i64.load, i64.store                     │
│   f32.load, f32.store, f64.load, f64.store                     │
├────────────────────────────────────────────────────────────────┤
│ TYPE CONVERSIONS                                                │
│   i32.wrap_i64, i64.extend_i32_s, i64.extend_i32_u             │
│   f32.demote_f64, f64.promote_f32                              │
│   i32.trunc_f64_s, f64.convert_i32_s                           │
├────────────────────────────────────────────────────────────────┤
│ CONTROL FLOW                                                    │
│   block, loop, if, br, br_if, br_table                         │
│   call, call_indirect, return                                   │
└────────────────────────────────────────────────────────────────┘
```

**No external dependencies** - these run in pure WASM sandbox.

---

## Layer 2: Host Bridge (Portable Runtime)

**Purpose:** Provide I/O and external resource access that works identically across ALL host environments.

**Responsibilities:**
- Console I/O (print, input)
- File system operations
- HTTP client requests
- Database queries
- Cryptographic operations
- String operations requiring external resources

**Implementation locations:**
- Rust: `clean-server/host-bridge/`
- Node.js: `clean-node-server/src/bridge/`
- Browser: Future polyfill implementation

**Complete function inventory:**

### Console I/O (14 functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `print` | `(ptr, len)` | Print string (no newline) |
| `printl` | `(ptr, len)` | Print string (with newline) |
| `print_string` | `(ptr, len)` | Alias for print |
| `print_integer` | `(value: i64)` | Print integer |
| `print_float` | `(value: f64)` | Print float |
| `print_boolean` | `(value: i32)` | Print "true"/"false" |
| `console_log` | `(ptr, len)` | Log (INFO level) |
| `console_error` | `(ptr, len)` | Log (ERROR level) |
| `console_warn` | `(ptr, len)` | Log (WARN level) |
| `input` | `(prompt_ptr, prompt_len) -> i32` | Read line |
| `console_input` | `(prompt_ptr, prompt_len) -> i32` | Alias for input |
| `input_integer` | `(prompt_ptr, prompt_len) -> i64` | Read integer |
| `input_float` | `(prompt_ptr, prompt_len) -> f64` | Read float |
| `input_yesno` | `(prompt_ptr, prompt_len) -> i32` | Read yes/no |

### Math Functions (30+ functions)
| Category | Functions |
|----------|-----------|
| Trigonometric | `math_sin`, `math_cos`, `math_tan`, `math_asin`, `math_acos`, `math_atan`, `math_atan2` |
| Hyperbolic | `math_sinh`, `math_cosh`, `math_tanh` |
| Logarithmic | `math_ln`, `math_log10`, `math_log2`, `math_exp`, `math_exp2` |
| Power/Root | `math_pow`, `math_sqrt` |
| Rounding | `math_floor`, `math_ceil`, `math_round`, `math_trunc` |
| Utility | `math_abs`, `math_min`, `math_max`, `math_sign` |
| Constants | `math_pi`, `math_e` |
| Random | `math_random` |

### String Operations (25+ functions)
| Function | Description |
|----------|-------------|
| `string_concat` | Concatenate two strings |
| `string_substring` | Extract substring |
| `string_trim` | Remove whitespace |
| `string_to_upper` | Convert to uppercase |
| `string_to_lower` | Convert to lowercase |
| `string_replace` | Replace occurrences |
| `string_split` | Split into array |
| `string_index_of` | Find substring |
| `string_compare` | Compare strings |
| `int_to_string` | Integer to string |
| `float_to_string` | Float to string |
| `bool_to_string` | Boolean to string |
| `string_to_int` | Parse integer |
| `string_to_float` | Parse float |
| `string_to_bool` | Parse boolean |

### File I/O (5 functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `file_read` | `(path_ptr, path_len) -> i32` | Read file contents |
| `file_write` | `(path_ptr, path_len, data_ptr, data_len) -> i32` | Write file |
| `file_exists` | `(path_ptr, path_len) -> i32` | Check file exists |
| `file_delete` | `(path_ptr, path_len) -> i32` | Delete file |
| `file_append` | `(path_ptr, path_len, data_ptr, data_len) -> i32` | Append to file |

### HTTP Client (20+ functions)
| Function | Description |
|----------|-------------|
| `http_get` | GET request |
| `http_post` | POST request |
| `http_put` | PUT request |
| `http_patch` | PATCH request |
| `http_delete` | DELETE request |
| `http_head` | HEAD request |
| `http_options` | OPTIONS request |
| `http_post_json` | POST with JSON |
| `http_put_json` | PUT with JSON |
| `http_patch_json` | PATCH with JSON |
| `http_post_form` | POST form data |
| `http_get_with_headers` | GET with headers |
| `http_post_with_headers` | POST with headers |
| `http_set_user_agent` | Set User-Agent |
| `http_set_timeout` | Set timeout |
| `http_set_max_redirects` | Set redirects |

### Database (5 functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `_db_query` | `(sql_ptr, sql_len, params_ptr, params_len) -> i32` | SELECT query |
| `_db_execute` | `(sql_ptr, sql_len, params_ptr, params_len) -> i64` | INSERT/UPDATE/DELETE |
| `_db_begin` | `() -> i32` | Begin transaction |
| `_db_commit` | `() -> i32` | Commit transaction |
| `_db_rollback` | `() -> i32` | Rollback transaction |

### Crypto (4 functions)
| Function | Description |
|----------|-------------|
| `_crypto_hash_password` | Hash password (bcrypt) |
| `_crypto_verify_password` | Verify password |
| `_crypto_random_bytes` | Generate random bytes |
| `_crypto_hash_sha256` | Compute SHA256 |

### Memory Runtime (5 functions)
| Function | Description |
|----------|-------------|
| `mem_alloc` | Allocate memory |
| `mem_retain` | Increment ref count |
| `mem_release` | Decrement ref count |
| `mem_scope_push` | Push allocation scope |
| `mem_scope_pop` | Pop scope, free |

---

## Layer 3: Server Extensions (Server-Only)

**Purpose:** Provide HTTP server functionality that only makes sense in a server context.

**Responsibilities:**
- HTTP routing and listening
- Request context access
- Session and authentication management
- Server-specific middleware

**Implementation locations:**
- Rust: `clean-server/src/`
- Node.js: `clean-node-server/src/server/`

**Functions (NEVER in host-bridge or compiler):**

### HTTP Server (3 functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `_http_listen` | `(port: i32) -> i32` | Start HTTP server |
| `_http_route` | `(method_ptr, method_len, path_ptr, path_len, handler_ptr) -> i32` | Register route |
| `_http_route_protected` | `(method, path, handler, required_role) -> i32` | Protected route |

### Request Context (6 functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `_req_param` | `(name_ptr, name_len) -> i32` | Get URL parameter |
| `_req_query` | `(name_ptr, name_len) -> i32` | Get query parameter |
| `_req_body` | `() -> i32` | Get request body |
| `_req_header` | `(name_ptr, name_len) -> i32` | Get request header |
| `_req_method` | `() -> i32` | Get HTTP method |
| `_req_path` | `() -> i32` | Get request path |

### Session Auth (5 functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `_auth_get_session` | `() -> i32` | Get session data |
| `_auth_set_session` | `(data_ptr, data_len) -> i32` | Set session data |
| `_auth_clear_session` | `() -> i32` | Clear session |
| `_auth_require_auth` | `() -> i32` | Require authentication |
| `_auth_require_role` | `(role_ptr, role_len) -> i32` | Require specific role |

### Response (4 functions)
| Function | Signature | Description |
|----------|-----------|-------------|
| `_res_status` | `(code: i32)` | Set response status |
| `_res_header` | `(name_ptr, name_len, value_ptr, value_len)` | Set response header |
| `_res_body` | `(body_ptr, body_len)` | Set response body |
| `_res_json` | `(json_ptr, json_len)` | Set JSON response |

---

## Layer 4: Plugin Layer (plugin.toml)

**Purpose:** Extend functionality through declarative plugin configurations.

**Responsibilities:**
- Custom bridge function declarations
- Third-party service integrations
- Domain-specific extensions
- Feature toggling

**Configuration:** `plugin.toml` files

**Example plugin.toml:**
```toml
[plugin]
name = "my-plugin"
version = "1.0.0"

[bridge]
# Custom bridge functions with string expansion
[bridge.functions]
my_custom_func = { params = ["string", "integer"], returns = "string", expand_strings = true }
```

**String Expansion (`expand_strings`):**
When `expand_strings = true`, the compiler automatically expands:
- `string` parameter → `(ptr: i32, len: i32)` pair
- Caller passes string, compiler generates ptr+len

---

## Layer 5: Application Layer (Framework & Apps)

**Purpose:** High-level abstractions for building applications.

**Components:**
- `clean-framework/` - Full-stack framework
- User applications built on Clean Language

**Responsibilities:**
- Component system
- State management
- Routing abstractions
- UI rendering
- Application lifecycle

---

## Component Responsibility Matrix

| Component | Layer | Responsibilities |
|-----------|-------|------------------|
| `clean-language-compiler` | 0 | Parse, analyze, generate WASM |
| WASM Runtime | 1 | Execute pure computations |
| `clean-server/host-bridge` | 2 | Portable I/O (Rust impl) |
| `clean-node-server/bridge` | 2 | Portable I/O (Node impl) |
| `clean-server` | 3 | HTTP server, routes, sessions |
| `clean-node-server` | 3 | HTTP server, routes, sessions |
| Plugin system | 4 | Custom extensions |
| `clean-framework` | 5 | Application framework |
| `clean-ui` | 5 | UI components |
| `clean-canvas` | 5 | Canvas rendering |

---

## Validation Checklist

### For Compiler Developers
- [ ] Only register functions that belong in Layer 0
- [ ] Generate imports (not implementations) for Layer 2+ functions
- [ ] Handle `expand_strings` for plugin declarations
- [ ] Never hardcode I/O implementations

### For Runtime Developers
- [ ] Implement ALL Layer 2 functions identically
- [ ] Follow exact function signatures from HOST_BRIDGE.md
- [ ] Use length-prefixed string format
- [ ] Server extensions only in Layer 3

### For Plugin Developers
- [ ] Declare functions in plugin.toml
- [ ] Implement bridge functions in host runtime
- [ ] Use `expand_strings` for string parameters

### For Framework Developers
- [ ] Build only on Layer 2-4 abstractions
- [ ] Never bypass the bridge layer
- [ ] Document required bridge functions

---

## Anti-Patterns (DO NOT DO)

### 1. Hardcoding I/O in Compiler
```rust
// WRONG - file I/O in compiler registry
registry.register("file.read", FileReadImpl);

// CORRECT - generate import, runtime provides implementation
// Compiler only generates: (import "env" "file_read" (func ...))
```

### 2. Server Functions in Host Bridge
```rust
// WRONG - request context in host-bridge
pub fn _req_param(...) { ... }

// CORRECT - only in clean-server/clean-node-server
```

### 3. Plugin Functions Without Declaration
```rust
// WRONG - using undeclared plugin function
my_custom_func("test");

// CORRECT - declare in plugin.toml first
[bridge.functions]
my_custom_func = { ... }
```

### 4. Bypassing Layers
```rust
// WRONG - framework directly calling WASM memory
memory.grow(10);

// CORRECT - use Layer 2 abstractions
mem_alloc(size, align);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-26 | Initial execution layers specification |

---

## References

- [Host Bridge Specification](./HOST_BRIDGE.md)
- [Memory Model](./MEMORY_MODEL.md)
- [Server Extensions](./SERVER_EXTENSIONS.md)
- [Implementing a New Host](./IMPLEMENTING_HOST.md)
