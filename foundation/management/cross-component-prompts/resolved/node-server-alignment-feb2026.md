# Cross-Component Prompt: Node Server Bridge Alignment (Feb 2026)

**Component:** clean-node-server
**Issue Type:** feature/compatibility
**Priority:** critical
**Created:** 2026-02-14
**Source Component:** clean-framework (gap analysis against compiler + framework plugins)
**Status:** Pending

---

## Summary

The node server (`v0.1.4`) is missing **~34 bridge functions** that the compiler generates as WASM imports and the framework plugins declare. The memory model and string handling are fully aligned -- only the function inventory has gaps.

---

## CRITICAL: Array Functions (13 missing)

Any Clean Language code using arrays will fail at runtime. The compiler generates these as `env` imports.

**New file: `src/bridge/array.ts`**

| Function | Signature (WASM) | Description |
|----------|------------------|-------------|
| `array_get` | `(arr_ptr, index) -> i32` | Get element at index, returns pointer |
| `array_set` | `(arr_ptr, index, value_ptr) -> void` | Set element at index |
| `array_push` | `(arr_ptr, value_ptr) -> i32` | Append element, return new array ptr |
| `array_pop` | `(arr_ptr) -> i32` | Remove and return last element |
| `array_slice` | `(arr_ptr, start, end) -> i32` | Extract subarray |
| `array_concat` | `(arr_ptr1, arr_ptr2) -> i32` | Concatenate two arrays |
| `array_reverse` | `(arr_ptr) -> i32` | Return reversed copy |
| `array_sort` | `(arr_ptr) -> i32` | Return sorted copy |
| `array_filter` | `(arr_ptr, callback_idx) -> i32` | Filter with callback |
| `array_map` | `(arr_ptr, callback_idx) -> i32` | Map with callback |
| `array_reduce` | `(arr_ptr, callback_idx, initial_ptr) -> i32` | Reduce with accumulator |
| `array_find` | `(arr_ptr, callback_idx) -> i32` | Find first matching element |
| `array_contains` | `(arr_ptr, value_ptr) -> i32` | Check if element exists (returns 0/1) |

### Implementation Notes

- Arrays in WASM memory are stored as length-prefixed sequences
- Element pointers reference length-prefixed strings or raw i32/f64 values
- Callback functions (`filter`, `map`, `reduce`, `find`) receive a WASM function table index -- invoke via `state.exports.__indirect_function_table.get(callback_idx)`
- Use `readPrefixedString` / `writeString` from helpers.ts for string elements
- Register all functions in `src/bridge/index.ts` under the `env` namespace

---

## CRITICAL: List Functions (8 missing)

List literals and list operations fail at runtime. The compiler generates these with dot-notation (`list.allocate`).

**New file: `src/bridge/list.ts`**

| Function | Signature (WASM) | Description |
|----------|------------------|-------------|
| `list.allocate` | `(capacity: i32) -> i32` | Allocate list memory, return list ptr |
| `list.push` | `(list_ptr, value: i32) -> void` | Push integer element |
| `list.push_f64` | `(list_ptr, value: f64) -> void` | Push float element |
| `list.add` | `(list_ptr, value_ptr) -> void` | Add element (generic) |
| `list.clear` | `(list_ptr) -> void` | Clear all elements |
| `list.get` | `(list_ptr, index: i32) -> i32` | Get element at index |
| `list.set` | `(list_ptr, index: i32, value: i32) -> void` | Set element at index |
| `list.remove` | `(list_ptr, index: i32) -> void` | Remove element at index |
| `list.contains` | `(list_ptr, value: i32) -> i32` | Check if contains (returns 0/1) |
| `list.isEmpty` | `(list_ptr) -> i32` | Check if empty (returns 0/1) |

### Implementation Notes

- The compiler uses dot-notation for these imports: `"list.allocate"` not `"list_allocate"`
- When registering in the WASM import object, use: `imports.env["list.allocate"] = ...`
- Lists are backed by a JS-side `Map<number, any[]>` keyed by pointer -- the pointer is a unique integer handle, not actual WASM memory
- `list.push` and `list.push_f64` differ by value type (i32 vs f64)

---

## HIGH: JWT Functions via Plugin Bridge (3 missing)

The `frame.auth` plugin declares these in `plugin.toml`. The node server has `_jwt_sign`, `_jwt_verify`, `_jwt_decode` internally but the **WASM import signatures may not match** what the plugin generates.

**Check and align in: `src/bridge/crypto.ts`**

| Plugin Declaration | Expected Signature | Node Server Status |
|-------------------|-------------------|-------------------|
| `_jwt_sign(string, string, string) -> string` | `(payload_ptr, payload_len, secret_ptr, secret_len, expires_ptr, expires_len) -> i32` | Verify signature matches |
| `_jwt_verify(string, string) -> string` | `(token_ptr, token_len, secret_ptr, secret_len) -> i32` | Verify signature matches |
| `_jwt_decode(string) -> string` | `(token_ptr, token_len) -> i32` | Verify signature matches |

### Action Required

1. Compare the WASM import names the compiler generates with what the node server registers
2. The plugin declares 2-param `_jwt_verify(token, secret)` but the node server may expect different param counts
3. Ensure the function is registered as `_jwt_sign` (not `jwt_sign`) in the import object

---

## HIGH: Session Persistence Functions (6 missing)

The `frame.auth` plugin declares session functions with **different signatures** than what the node server currently implements.

**Align in: `src/bridge/session.ts`**

| Plugin Declaration | Expected Signature | Current Node Server |
|-------------------|-------------------|-------------------|
| `_session_store(string, string) -> integer` | `(key_ptr, key_len, value_ptr, value_len) -> i32` | Missing -- node server has `_session_create` instead |
| `_session_get(string) -> string` | `(key_ptr, key_len) -> i32` | Missing -- node server has `_session_get()` (no params) |
| `_session_delete(string) -> integer` | `(key_ptr, key_len) -> i32` | Missing -- node server has `_session_destroy()` (no params) |
| `_session_exists(string) -> integer` | `(key_ptr, key_len) -> i32` | Missing -- node server has `_session_exists()` (no params) |
| `_session_set_csrf(string) -> integer` | `(token_ptr, token_len) -> i32` | Not implemented |
| `_session_get_csrf() -> string` | `() -> i32` | Not implemented |

### Implementation Notes

- The plugin uses key-value session storage (`_session_store("email", email)`)
- The node server uses a session-object approach (`_session_create(userId, role, claims)`)
- Both models should be supported -- add the key-value functions alongside existing session functions
- CSRF functions are needed for form security in the framework

---

## HIGH: Cookie Setting via Plugin (1 missing)

| Plugin Declaration | Expected Signature | Node Server Status |
|-------------------|-------------------|-------------------|
| `_http_set_cookie(string, string, string) -> string` | `(name_ptr, name_len, value_ptr, value_len, options_ptr, options_len) -> i32` | Node server has this function but verify the 3-string-param signature matches what the compiler generates |

---

## MEDIUM: Role Management Functions (3 missing)

**Add to: `src/bridge/auth.ts`**

| Function | Signature | Description |
|----------|-----------|-------------|
| `_roles_register(string) -> integer` | `(roles_json_ptr, roles_json_len) -> i32` | Register role definitions (JSON: `{"admin": ["read","write","delete"]}`) |
| `_role_has_permission(string, string) -> boolean` | `(role_ptr, role_len, perm_ptr, perm_len) -> i32` | Check if role has specific permission |
| `_role_get_permissions(string) -> string` | `(role_ptr, role_len) -> i32` | Get all permissions for a role (returns JSON array) |

### Implementation Notes

- Store roles in a `Map<string, string[]>` on the server state
- `_roles_register` accepts JSON with role-to-permissions mapping
- These are used by `_auth_can(permission)` and `_auth_require_role(role)` internally

---

## MEDIUM: JSON Navigation (1 missing)

| Function | Signature | Description |
|----------|-----------|-------------|
| `_json_get(string, string) -> string` | `(json_ptr, json_len, path_ptr, path_len) -> i32` | Extract value from JSON by dot-path (e.g., `"user.email"`) |

**Add to: `src/bridge/http-server.ts`** or create `src/bridge/json.ts`

---

## LOW: String Dot-Notation Aliases (3 missing)

The compiler may generate dot-notation imports for string functions. Add aliases in `src/bridge/index.ts`:

```typescript
// In the import object construction:
"string.toNumber": stringBridge.string_to_float,
"string.toUpperCase": stringBridge.string_to_upper,
"string.toLowerCase": stringBridge.string_to_lower,
```

---

## Naming Mismatch: Crypto Random

| Plugin Expects | Node Server Has |
|---------------|----------------|
| `_crypto_random_hex(integer) -> string` | `_crypto_random_hex` (verify name matches) |

The node server may register this as `crypto_random_bytes` -- verify and add an alias if needed.

---

## Testing Plan

After implementing all functions:

### 1. Unit Tests

Add test files:
- `tests/array.test.ts` -- Array function CRUD and callbacks
- `tests/list.test.ts` -- List allocation, push, get, remove
- `tests/jwt-plugin.test.ts` -- JWT sign/verify with plugin signatures
- `tests/session-kv.test.ts` -- Key-value session store/get/delete
- `tests/roles.test.ts` -- Role registration and permission checks

### 2. Integration Test with Compiler Output

```bash
# Compile a Clean Language file that uses arrays
cd /path/to/clean-language-compiler
cargo run --bin cleanc -- test-arrays.cln /tmp/test-arrays.wasm

# Run on node server
cd /path/to/clean-node-server
node dist/index.js /tmp/test-arrays.wasm
```

### 3. Framework Plugin Test

```bash
# Compile a Frame app with auth plugin
cd /path/to/clean-framework/examples/complete-demo
cln compile app/api/main.cln --output /tmp/api.wasm

# Run on node server
clean-node-server /tmp/api.wasm --port 3000 --database sqlite:///tmp/test.db

# Test auth endpoints
curl -X POST http://localhost:3000/api/auth/register -d '{"email":"test@test.com","password":"pass123"}'
curl -X POST http://localhost:3000/api/auth/login -d '{"email":"test@test.com","password":"pass123"}'
```

---

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| **CREATE** | `src/bridge/array.ts` | 13 array functions |
| **CREATE** | `src/bridge/list.ts` | 10 list functions |
| **MODIFY** | `src/bridge/session.ts` | Add key-value session functions + CSRF |
| **MODIFY** | `src/bridge/auth.ts` | Add role management functions |
| **MODIFY** | `src/bridge/crypto.ts` | Verify JWT signatures match plugin |
| **MODIFY** | `src/bridge/http-server.ts` | Add `_json_get`, verify cookie signature |
| **MODIFY** | `src/bridge/index.ts` | Register all new functions + aliases |

---

## Priority Order

1. **Array + List functions** (CRITICAL -- blocks all array/list code)
2. **JWT signature alignment** (HIGH -- blocks auth features)
3. **Session key-value functions** (HIGH -- blocks session persistence)
4. **Role management** (MEDIUM -- blocks RBAC setup)
5. **JSON navigation + string aliases** (LOW -- convenience)

---

## Reference Documents

- Compiler WASM imports: `clean-language-compiler/src/codegen/` (search for `import_section`)
- Framework plugin declarations: `clean-framework/plugins/frame.auth/plugin.toml` and `clean-framework/plugins/frame.httpserver/plugin.toml`
- Platform architecture: `platform-architecture/HOST_BRIDGE.md` and `platform-architecture/SERVER_EXTENSIONS.md`
- Memory model: `platform-architecture/MEMORY_MODEL.md`
