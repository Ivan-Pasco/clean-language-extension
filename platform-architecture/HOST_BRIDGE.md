# Host Bridge Specification

Complete reference for all portable host functions available in the `host-bridge` library.

## Function Signatures

All functions use the following conventions:
- Strings are passed as `(ptr: i32, len: i32)` pairs
- String returns are pointers to length-prefixed data (i32)
- Booleans are i32 (0 = false, 1 = true)
- Numbers are f64 for floating point, i32/i64 for integers

---

## Console I/O (14 functions)

### Basic Output

| Function | Signature | Description |
|----------|-----------|-------------|
| `print` | `(ptr: i32, len: i32)` | Print string without newline |
| `printl` | `(ptr: i32, len: i32)` | Print string with newline |
| `print_string` | `(ptr: i32, len: i32)` | Alias for print |
| `print_integer` | `(value: i64)` | Print integer value |
| `print_float` | `(value: f64)` | Print float value |
| `print_boolean` | `(value: i32)` | Print "true" or "false" |

### Console Methods

| Function | Signature | Description |
|----------|-----------|-------------|
| `console_log` | `(ptr: i32, len: i32)` | Log message (INFO level) |
| `console_error` | `(ptr: i32, len: i32)` | Log error (ERROR level) |
| `console_warn` | `(ptr: i32, len: i32)` | Log warning (WARN level) |

### Input

| Function | Signature | Description |
|----------|-----------|-------------|
| `input` | `(prompt_ptr: i32, prompt_len: i32) -> i32` | Read line with prompt |
| `console_input` | `(prompt_ptr: i32, prompt_len: i32) -> i32` | Alias for input |
| `input_integer` | `(prompt_ptr: i32, prompt_len: i32) -> i64` | Read and parse integer |
| `input_float` | `(prompt_ptr: i32, prompt_len: i32) -> f64` | Read and parse float |
| `input_yesno` | `(prompt_ptr: i32, prompt_len: i32) -> i32` | Read yes/no (returns 0/1) |
| `input_range` | `(prompt_ptr: i32, prompt_len: i32, min: i32, max: i32) -> i32` | Read integer in range |

---

## Math Functions (30+ functions)

All math functions are available with both underscore (`math_sin`) and dot (`math.sin`) notation.

### Trigonometric

| Function | Signature | Description |
|----------|-----------|-------------|
| `math_sin` / `math.sin` | `(x: f64) -> f64` | Sine |
| `math_cos` / `math.cos` | `(x: f64) -> f64` | Cosine |
| `math_tan` / `math.tan` | `(x: f64) -> f64` | Tangent |
| `math_asin` / `math.asin` | `(x: f64) -> f64` | Arc sine |
| `math_acos` / `math.acos` | `(x: f64) -> f64` | Arc cosine |
| `math_atan` / `math.atan` | `(x: f64) -> f64` | Arc tangent |
| `math_atan2` / `math.atan2` | `(y: f64, x: f64) -> f64` | Two-argument arc tangent |

### Hyperbolic

| Function | Signature | Description |
|----------|-----------|-------------|
| `math_sinh` / `math.sinh` | `(x: f64) -> f64` | Hyperbolic sine |
| `math_cosh` / `math.cosh` | `(x: f64) -> f64` | Hyperbolic cosine |
| `math_tanh` / `math.tanh` | `(x: f64) -> f64` | Hyperbolic tangent |

### Logarithmic & Exponential

| Function | Signature | Description |
|----------|-----------|-------------|
| `math_ln` / `math.ln` | `(x: f64) -> f64` | Natural logarithm |
| `math_log10` / `math.log10` | `(x: f64) -> f64` | Base-10 logarithm |
| `math_log2` / `math.log2` | `(x: f64) -> f64` | Base-2 logarithm |
| `math_exp` / `math.exp` | `(x: f64) -> f64` | e^x |
| `math_exp2` / `math.exp2` | `(x: f64) -> f64` | 2^x |

### Power & Root

| Function | Signature | Description |
|----------|-----------|-------------|
| `math_pow` / `math.pow` | `(base: f64, exp: f64) -> f64` | Power |
| `math_sqrt` / `math.sqrt` | `(x: f64) -> f64` | Square root |

---

## String Operations (25+ functions)

### Concatenation & Modification

| Function | Signature | Description |
|----------|-----------|-------------|
| `string_concat` / `string.concat` | `(a_ptr: i32, a_len: i32, b_ptr: i32, b_len: i32) -> i32` | Concatenate two strings |
| `string_substring` | `(ptr: i32, len: i32, start: i32, end: i32) -> i32` | Extract substring |
| `string_trim` | `(ptr: i32, len: i32) -> i32` | Remove whitespace |
| `string_to_upper` | `(ptr: i32, len: i32) -> i32` | Convert to uppercase |
| `string_to_lower` | `(ptr: i32, len: i32) -> i32` | Convert to lowercase |
| `string_replace` | `(ptr: i32, len: i32, find_ptr: i32, find_len: i32, replace_ptr: i32, replace_len: i32) -> i32` | Replace occurrences |
| `string_split` | `(ptr: i32, len: i32, delim_ptr: i32, delim_len: i32) -> i32` | Split into JSON array |

### Type Conversions

| Function | Signature | Description |
|----------|-----------|-------------|
| `int_to_string` | `(value: i64) -> i32` | Integer to string |
| `float_to_string` | `(value: f64) -> i32` | Float to string |
| `bool_to_string` | `(value: i32) -> i32` | Boolean to "true"/"false" |
| `string_to_int` | `(ptr: i32, len: i32) -> i64` | Parse string to integer |
| `string_to_float` | `(ptr: i32, len: i32) -> f64` | Parse string to float |
| `string_to_bool` | `(ptr: i32, len: i32) -> i32` | Parse string to boolean |

### Comparison & Search

| Function | Signature | Description |
|----------|-----------|-------------|
| `string_compare` | `(a_ptr: i32, a_len: i32, b_ptr: i32, b_len: i32) -> i32` | Compare (-1, 0, 1) |
| `string_index_of` | `(haystack_ptr: i32, haystack_len: i32, needle_ptr: i32, needle_len: i32) -> i32` | Find substring index (-1 if not found) |

---

## Memory Runtime (5 functions)

| Function | Module | Signature | Description |
|----------|--------|-----------|-------------|
| `mem_alloc` | `memory_runtime` | `(size: i32, align: i32) -> i32` | Allocate memory |
| `mem_retain` | `memory_runtime` | `(ptr: i32)` | Increment reference count |
| `mem_release` | `memory_runtime` | `(ptr: i32)` | Decrement reference count |
| `mem_scope_push` | `memory_runtime` | `()` | Push allocation scope |
| `mem_scope_pop` | `memory_runtime` | `()` | Pop scope, free allocations |

---

## Database (5 functions)

All database functions require a configured `DbBridge` in the host state.

| Function | Signature | Description |
|----------|-----------|-------------|
| `_db_query` | `(sql_ptr: i32, sql_len: i32, params_ptr: i32, params_len: i32) -> i32` | Execute SELECT, return JSON rows |
| `_db_execute` | `(sql_ptr: i32, sql_len: i32, params_ptr: i32, params_len: i32) -> i64` | Execute INSERT/UPDATE/DELETE, return affected rows |
| `_db_begin` | `() -> i32` | Begin transaction (1=success) |
| `_db_commit` | `() -> i32` | Commit transaction (1=success) |
| `_db_rollback` | `() -> i32` | Rollback transaction (1=success) |

### Query Parameters Format

Parameters are passed as JSON array:
```json
["value1", 42, true, null]
```

### Query Result Format

Results are returned as JSON array of objects:
```json
[
  {"id": 1, "name": "Alice"},
  {"id": 2, "name": "Bob"}
]
```

---

## File I/O (5 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| `file_read` | `(path_ptr: i32, path_len: i32) -> i32` | Read file contents |
| `file_write` | `(path_ptr: i32, path_len: i32, data_ptr: i32, data_len: i32) -> i32` | Write file (1=success) |
| `file_exists` | `(path_ptr: i32, path_len: i32) -> i32` | Check file exists (0/1) |
| `file_delete` | `(path_ptr: i32, path_len: i32) -> i32` | Delete file (1=success) |
| `file_append` | `(path_ptr: i32, path_len: i32, data_ptr: i32, data_len: i32) -> i32` | Append to file (1=success) |

---

## HTTP Client (20+ functions)

### Basic Methods

| Function | Signature | Description |
|----------|-----------|-------------|
| `http_get` | `(url_ptr: i32, url_len: i32) -> i32` | GET request, return body |
| `http_post` | `(url_ptr: i32, url_len: i32, body_ptr: i32, body_len: i32) -> i32` | POST request |
| `http_put` | `(url_ptr: i32, url_len: i32, body_ptr: i32, body_len: i32) -> i32` | PUT request |
| `http_patch` | `(url_ptr: i32, url_len: i32, body_ptr: i32, body_len: i32) -> i32` | PATCH request |
| `http_delete` | `(url_ptr: i32, url_len: i32) -> i32` | DELETE request |
| `http_head` | `(url_ptr: i32, url_len: i32) -> i32` | HEAD request (headers as JSON) |
| `http_options` | `(url_ptr: i32, url_len: i32) -> i32` | OPTIONS request |

### JSON Methods

| Function | Signature | Description |
|----------|-----------|-------------|
| `http_post_json` | `(url_ptr: i32, url_len: i32, json_ptr: i32, json_len: i32) -> i32` | POST with JSON Content-Type |
| `http_put_json` | `(url_ptr: i32, url_len: i32, json_ptr: i32, json_len: i32) -> i32` | PUT with JSON Content-Type |
| `http_patch_json` | `(url_ptr: i32, url_len: i32, json_ptr: i32, json_len: i32) -> i32` | PATCH with JSON Content-Type |

### Form Data

| Function | Signature | Description |
|----------|-----------|-------------|
| `http_post_form` | `(url_ptr: i32, url_len: i32, form_ptr: i32, form_len: i32) -> i32` | POST form-urlencoded |

### With Headers

| Function | Signature | Description |
|----------|-----------|-------------|
| `http_get_with_headers` | `(url_ptr: i32, url_len: i32, headers_ptr: i32, headers_len: i32) -> i32` | GET with custom headers |
| `http_post_with_headers` | `(url_ptr: i32, url_len: i32, body_ptr: i32, body_len: i32, headers_ptr: i32, headers_len: i32) -> i32` | POST with custom headers |

Headers are passed as JSON object:
```json
{"Authorization": "Bearer token", "X-Custom": "value"}
```

### Configuration

| Function | Signature | Description |
|----------|-----------|-------------|
| `http_set_user_agent` | `(ua_ptr: i32, ua_len: i32)` | Set User-Agent for requests |
| `http_set_timeout` | `(ms: i32)` | Set request timeout |
| `http_set_max_redirects` | `(count: i32)` | Set max redirect follows |

---

## Crypto (4 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| `_auth_hash_password` | `(password_ptr: i32, password_len: i32) -> i32` | Hash password (bcrypt) |
| `_auth_verify_password` | `(password_ptr: i32, password_len: i32, hash_ptr: i32, hash_len: i32) -> i32` | Verify password (0/1) |
| `crypto_random_bytes` | `(len: i32) -> i32` | Generate random bytes (hex string) |
| `crypto_sha256` | `(data_ptr: i32, data_len: i32) -> i32` | Compute SHA256 hash (hex string) |

---

## Error Handling

Functions that can fail follow these conventions:

1. **String returns**: Return empty string (`""`) on error
2. **Boolean returns**: Return 0 on error
3. **Integer returns**: Return 0 or -1 on error (function-specific)
4. **State errors**: Use `set_error()` on the WasmStateCore trait

Hosts can check `last_error()` for detailed error messages after failures.
