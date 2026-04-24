# Clean Language Standard Library Reference

**Authority:** This file is the single source of truth for built-in function signatures (Principle 3).
**Version:** 1.1.0
**Date:** 2026-04-19

Every built-in function is listed with its exact signature, parameter types, return type, and execution layer. The WASM import name is the contract between the compiler and the runtime — if these don't match, the function will fail at instantiation.

For Layer 2/3 WASM signatures, string parameters are always `(ptr: i32, len: i32)` pairs. Return type `ptr` means a length-prefixed string pointer `(i32)`.

---

## Execution Layers

| Layer | Provider | Scope |
|-------|----------|-------|
| Layer 1 | Compiler (WASM native) | Available everywhere |
| Layer 2 | Host Bridge (Rust server / Node server) | Available everywhere (portable I/O) |
| Layer 3 | Server Extensions | Available only in server context |

---

## 1. Console I/O

**Layer:** 2 (Host Bridge) for all output and input functions.

> **Error semantics for this section:** Output functions (`print`, `printl`) never fail. Input functions return a valid value of the declared type after retry; they do not return null. `input` halts if stdin is closed (non-interactive context).

### Clean Language API

| Function / Syntax | Parameters | Returns | Layer |
|-------------------|-----------|---------|-------|
| `print(value)` | string | void | 2 |
| `print(value) +` | string | void | 2 |
| `printl(value)` | string | void | 2 |
| `input(prompt)` | string | string | 2 |
| `input.integer(prompt)` | string | integer | 2 |
| `input.number(prompt)` | string | number | 2 |
| `input.yesNo(prompt)` | string | boolean | 2 |

#### `print:` Block

The `print:` block is a syntactic shorthand for printing multiple expressions, one per line. Each indented expression is equivalent to a `print(expr) +` call. The block must contain at least one expression (SYN008).

```clean
print:
    "User: " + username
    "Score: " + score.toString()
    "Status: active"
```

Is exactly equivalent to:

```clean
print("User: " + username) +
print("Score: " + score.toString()) +
print("Status: active") +
```

### WASM Imports (Layer 2)

| Import Name | Params | Returns | Module |
|-------------|--------|---------|--------|
| `print` | `(ptr: i32, len: i32)` | void | env |
| `printl` | `(ptr: i32, len: i32)` | void | env |
| `print_integer` | `(value: i64)` | void | env |
| `print_float` | `(value: f64)` | void | env |
| `print_boolean` | `(value: i32)` | void | env |
| `console_log` | `(ptr: i32, len: i32)` | void | env |
| `console_error` | `(ptr: i32, len: i32)` | void | env |
| `console_warn` | `(ptr: i32, len: i32)` | void | env |
| `input` | `(prompt_ptr: i32)` | `ptr: i32` | env |
| `input_integer` | `(prompt_ptr: i32)` | `i32` | env |
| `input_float` | `(prompt_ptr: i32)` | `f64` | env |
| `input_yesno` | `(prompt_ptr: i32)` | `i32` | env |

---

## 2. Math

**Layer:** 2 (Host Bridge).

> **Error semantics:** Pure functions like `math.abs`, `math.sqrt` never fail for valid numeric input. `math.sqrt` of a negative number returns `NaN` (IEEE 754). `math.log` of zero or a negative number returns `-Infinity` or `NaN` respectively.

### Clean Language API (`math.` namespace)

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `math.abs(x)` | number | number | 2 |
| `math.sqrt(x)` | number | number | 2 |
| `math.pow(x, y)` | number, number | number | 2 |
| `math.sin(x)` | number | number | 2 |
| `math.cos(x)` | number | number | 2 |
| `math.tan(x)` | number | number | 2 |
| `math.asin(x)` | number | number | 2 |
| `math.acos(x)` | number | number | 2 |
| `math.atan(x)` | number | number | 2 |
| `math.atan2(y, x)` | number, number | number | 2 |
| `math.sinh(x)` | number | number | 2 |
| `math.cosh(x)` | number | number | 2 |
| `math.tanh(x)` | number | number | 2 |
| `math.log(x)` | number | number | 2 |
| `math.ln(x)` | number | number | 2 |
| `math.log10(x)` | number | number | 2 |
| `math.log2(x)` | number | number | 2 |
| `math.exp(x)` | number | number | 2 |
| `math.floor(x)` | number | number | 2 |
| `math.ceil(x)` | number | number | 2 |
| `math.round(x)` | number | number | 2 |
| `math.trunc(x)` | number | number | 2 |
| `math.sign(x)` | number | number | 2 |
| `math.max(a, b)` | number, number | number | 2 |
| `math.min(a, b)` | number, number | number | 2 |
| `math.random()` | — | number | 2 |
| `math.pi()` | — | number | 2 |
| `math.e()` | — | number | 2 |

### WASM Imports

All math functions use `f64` parameters and return `f64`. Import names follow the pattern `math_<name>` in module `env`.

---

## 3. Type Conversions

**Layer:** 2 (Host Bridge).

> **Error semantics:** `.toInteger()` on a non-numeric string returns `0`. `.toNumber()` on a non-numeric string returns `0.0`. `.toBoolean()` on a string accepts `"true"`/`"false"`/`"1"`/`"0"`; other values return `false`. These functions never halt.

### Clean Language API (method-style)

| Method | On Type | Returns | Layer |
|--------|---------|---------|-------|
| `.toString()` | integer, number, boolean | string | 2 |
| `.toInteger()` | string, number | integer | 2 |
| `.toNumber()` | string, integer | number | 2 |
| `.toBoolean()` | string, integer | boolean | 2 |

### WASM Imports

| Import Name | Params | Returns | Module |
|-------------|--------|---------|--------|
| `int_to_string` | `(value: i64)` | `ptr: i32` | env |
| `float_to_string` | `(value: f64)` | `ptr: i32` | env |
| `bool_to_string` | `(value: i32)` | `ptr: i32` | env |
| `string_to_int` | `(ptr: i32)` | `i32` | env |
| `string_to_float` | `(ptr: i32)` | `f64` | env |

---

## 4. String Operations

**Layer:** 2 (Host Bridge).

> **Error semantics:** `.charAt(index)` and `.charCodeAt(index)` halt if `index` is out of bounds. `.substring(start, end)` clamps to valid range rather than halting. `.indexOf` and `.lastIndexOf` return `-1` when not found — they never fail. `.split`, `.trim`, `.toUpperCase`, `.toLowerCase`, `.replace`, `.padStart`, `.padEnd`, `.repeat` never fail.

### Clean Language API (method-style on string values)

| Method | Parameters | Returns | Layer |
|--------|-----------|---------|-------|
| `.length()` | — | integer | 2 |
| `.substring(start, end)` | integer, integer | string | 2 |
| `.charAt(index)` | integer | string | 2 |
| `.indexOf(search)` | string | integer (-1 if not found) | 2 |
| `.lastIndexOf(search)` | string | integer | 2 |
| `.contains(search)` | string | boolean | 2 |
| `.startsWith(prefix)` | string | boolean | 2 |
| `.endsWith(suffix)` | string | boolean | 2 |
| `.replace(old, new)` | string, string | string | 2 |
| `.split(delimiter)` | string | list\<string\> | 2 |
| `.trim()` | — | string | 2 |
| `.trimStart()` | — | string | 2 |
| `.trimEnd()` | — | string | 2 |
| `.toUpperCase()` | — | string | 2 |
| `.toLowerCase()` | — | string | 2 |
| `.isEmpty()` | — | boolean | 2 |
| `.isNotEmpty()` | — | boolean | 2 |
| `.isBlank()` | — | boolean | 2 |
| `.padStart(width, char)` | integer, string | string | 2 |
| `.padEnd(width, char)` | integer, string | string | 2 |
| `.charCodeAt(index)` | integer | integer | 2 |
| `.repeat(count)` | integer | string | 2 |

### WASM Imports

| Import Name | Params | Returns | Module |
|-------------|--------|---------|--------|
| `string.concat` | `(a_ptr: i32, b_ptr: i32)` | `ptr: i32` | env |
| `string_compare` | `(a_ptr: i32, b_ptr: i32)` | `i32` (-1/0/1) | env |
| `string_replace` | `(str: i32, old: i32, new: i32)` | `ptr: i32` | env |
| `string.split` | `(str_ptr: i32, delim_ptr: i32)` | `ptr: i32` | env |
| `string_trim` | `(ptr: i32)` | `ptr: i32` | env |
| `string_trim_start` | `(ptr: i32)` | `ptr: i32` | env |
| `string_trim_end` | `(ptr: i32)` | `ptr: i32` | env |
| `string_to_upper` | `(ptr: i32)` | `ptr: i32` | env |
| `string_to_lower` | `(ptr: i32)` | `ptr: i32` | env |
| `string_index_of` | `(str: i32, search: i32)` | `i32` | env |
| `string_pad_start` | `(str: i32, width: i32, pad_ptr: i32, pad_len: i32)` | `ptr: i32` | env |
| `string_pad_end` | `(str: i32, width: i32, pad_ptr: i32, pad_len: i32)` | `ptr: i32` | env |
| `string_char_code_at` | `(str: i32, index: i32)` | `i32` | env |
| `string_repeat` | `(str: i32, count: i32)` | `ptr: i32` | env |
| `string_is_blank` | `(str: i32)` | `i32` | env |

---

## 5. List Operations

**Layer:** 1 (Compiler/WASM native) for most operations; Layer 2 (Host Bridge) for `.push()`.

> **Error semantics:** `.get(index)`, `.set(index, value)`, `.remove(index)` halt if `index` is out of bounds. `.first()` and `.last()` halt if the list is empty. `.pop()` halts if the list is empty. Functions that do not access by index (`.length()`, `.isEmpty()`, `.contains()`, `.sort()`, `.reverse()`, `.concat()`) never fail.

### Clean Language API (method-style on list values)

| Method | Parameters | Returns | Layer |
|--------|-----------|---------|-------|
| `.length()` | — | integer | 1 |
| `.push(item)` | element type | list | 2 |
| `.pop()` | — | element type | 1 |
| `.get(index)` | integer | element type | 1 |
| `.set(index, value)` | integer, element type | void | 1 |
| `.contains(item)` | element type | boolean | 1 |
| `.indexOf(item)` | element type | integer | 1 |
| `.isEmpty()` | — | boolean | 1 |
| `.isNotEmpty()` | — | boolean | 1 |
| `.first()` | — | element type | 1 |
| `.last()` | — | element type | 1 |
| `.reverse()` | — | list | 1 |
| `.slice(start, end)` | integer, integer | list | 1 |
| `.insert(index, item)` | integer, element type | list | 1 |
| `.remove(index)` | integer | element type | 1 |
| `.concat(other)` | list | list | 1 |
| `.sort()` | — | list | 1 |
| `.join(delimiter)` | string | string | 1 |

### Namespace Functions

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `list.range(start, end)` | integer, integer | list\<integer\> | 1 |

---

## 6. File I/O

**Layer:** 2 (Host Bridge).

> **Error semantics:** `file.read` returns `null` if the file does not exist (use `default` or `onError` to handle). `file.write` and `file.append` halt on I/O errors (permission denied, disk full). `file.exists` never fails. `file.delete` does nothing and returns without error if the file is not found.

### Clean Language API (`file.` namespace)

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `file.read(path)` | string | string | 2 |
| `file.write(path, content)` | string, string | void | 2 |
| `file.append(path, content)` | string, string | void | 2 |
| `file.exists(path)` | string | boolean | 2 |
| `file.delete(path)` | string | void | 2 |

### WASM Imports

| Import Name | Params | Returns | Module |
|-------------|--------|---------|--------|
| `file_read` | `(path_ptr: i32, path_len: i32, mode: i32)` | `ptr: i32` | env |
| `file_write` | `(path_ptr: i32, path_len: i32, data_ptr: i32, data_len: i32)` | `i32` | env |
| `file_exists` | `(path_ptr: i32, path_len: i32)` | `i32` | env |
| `file_delete` | `(path_ptr: i32, path_len: i32)` | `i32` | env |
| `file_append` | `(path_ptr: i32, path_len: i32, data_ptr: i32, data_len: i32)` | `i32` | env |

---

## 7. HTTP Client

**Layer:** 2 (Host Bridge).

> **Error semantics:** All HTTP functions return the response body as a string on success. On network failure, DNS error, or non-2xx response, they raise an error that propagates via `onError`. Use `onError` to handle failures gracefully.

### Clean Language API (`http.` namespace)

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `http.get(url)` | string | string | 2 |
| `http.post(url, body)` | string, string | string | 2 |
| `http.put(url, body)` | string, string | string | 2 |
| `http.patch(url, body)` | string, string | string | 2 |
| `http.delete(url)` | string | string | 2 |
| `http.head(url)` | string | string | 2 |
| `http.options(url)` | string | string | 2 |
| `http.postJson(url, json)` | string, string | string | 2 |
| `http.putJson(url, json)` | string, string | string | 2 |
| `http.postForm(url, form)` | string, string | string | 2 |
| `http.getWithHeaders(url, headers)` | string, string | string | 2 |
| `http.postWithHeaders(url, body, headers)` | string, string, string | string | 2 |
| `http.encodeUrl(value)` | string | string | 2 |
| `http.decodeUrl(value)` | string | string | 2 |
| `http.buildQuery(json)` | string | string | 2 |

---

## 8. JSON

**Layer:** 3 (Server Extensions, as currently implemented; pure-WASM implementation planned for Layer 1).

> **Error semantics:** `json.encode` and `json.decode` raise an error on invalid input — use `onError` to handle. `json.get` returns `null` if the path does not exist, never halts.

### Clean Language API

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `json.encode(value)` | string | string | 3 |
| `json.decode(json)` | string | string | 3 |
| `json.get(json, path)` | string, string | string | 3 |

The `json.get` function uses dot-separated paths: `json.get(result, "data.rows.0.name")`.

---

## 9. Database

**Layer:** 2 (Host Bridge).

> **Error semantics:** All database functions raise an error on connection failure, query error, or constraint violation. Use `onError` to handle failures. `db.begin`, `db.commit`, and `db.rollback` return `false` on failure rather than halting (check the return value).

### Clean Language API (`db.` namespace)

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `db.query(sql, params)` | string, string | string (JSON) | 2 |
| `db.execute(sql, params)` | string, string | integer (affected rows) | 2 |
| `db.begin()` | — | boolean | 2 |
| `db.commit()` | — | boolean | 2 |
| `db.rollback()` | — | boolean | 2 |

Parameters are passed as a JSON array: `db.query("SELECT * FROM users WHERE id = ?", "[1]")`.

---

## 10. Crypto

**Layer:** 2 (Host Bridge).

> **Error semantics:** `crypto.verifyPassword` returns `false` on mismatch, never halts. `crypto.hashPassword` halts on invalid input. All functions are pure with respect to observable state — they read no external resources.

### Clean Language API (`crypto.` namespace)

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `crypto.hashPassword(plain)` | string | string | 2 |
| `crypto.verifyPassword(plain, hash)` | string, string | boolean | 2 |
| `crypto.randomBytes(count)` | integer | string (base64) | 2 |
| `crypto.randomHex(count)` | integer | string (hex) | 2 |
| `crypto.sha256(data)` | string | string (hex) | 2 |
| `crypto.sha512(data)` | string | string (hex) | 2 |
| `crypto.hmac(algo, key, data)` | string, string, string | string (hex) | 2 |

---

## 11. JWT

**Layer:** 2 (Host Bridge).

> **Error semantics:** `jwt.sign` raises an error if the payload or secret is invalid. `jwt.verify` returns `null` if the token is invalid or the signature does not match (do not use `!` on the result without checking). `jwt.decode` decodes without verification and never fails on well-formed base64; it raises an error on malformed input.

### Clean Language API (`jwt.` namespace)

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `jwt.sign(payload, secret, algo)` | string, string, string | string | 2 |
| `jwt.verify(token, secret, algo)` | string, string, string | string (JSON) | 2 |
| `jwt.decode(token)` | string | string (JSON) | 2 |

---

## 12. Environment & Time

**Layer:** 2 (Host Bridge).

> **Error semantics:** `env.get` returns `null` if the environment variable is not set — use `default` for a fallback. `time.now` never fails.

| Function | Parameters | Returns | Layer |
|----------|-----------|---------|-------|
| `env.get(name)` | string | string | 2 |
| `time.now()` | — | integer (unix seconds) | 2 |

---

## 13. Memory Management

**Layer:** 1 (Compiler/WASM native — internal use only).

These are internal functions used by the compiler's generated code. They are not called directly from Clean Language.

| Import Name | Params | Returns | Module |
|-------------|--------|---------|--------|
| `mem_alloc` | `(size: i32, align: i32)` | `i32` | memory_runtime |
| `mem_retain` | `(ptr: i32)` | void | memory_runtime |
| `mem_release` | `(ptr: i32)` | void | memory_runtime |
| `mem_scope_push` | — | void | memory_runtime |
| `mem_scope_pop` | — | void | memory_runtime |

---

## 14. Server-Only Functions (Layer 3)

**Layer:** 3 (Server Extensions — only available in server context).

These functions are only available when the code runs in a server context (clean-server). They require the `frame.server` plugin.

> **Error semantics:** Request context functions (`req.*`) halt if called outside a request handler (no active request context). Response functions (`http.respond`, `http.redirect`) halt if called after a response has already been sent. Auth functions return `false` or `null` on failure rather than halting, unless noted.



### Request Context

| Function | Parameters | Returns |
|----------|-----------|---------|
| `req.param(name)` | string | string |
| `req.query(name)` | string | string |
| `req.body()` | — | string |
| `req.header(name)` | string | string |
| `req.headers()` | — | string (JSON) |
| `req.method()` | — | string |
| `req.path()` | — | string |
| `req.ip()` | — | string |
| `req.form()` | — | string (JSON) |
| `req.cookie(name)` | string | string |

### Response

| Function | Parameters | Returns |
|----------|-----------|---------|
| `http.respond(status, contentType, body)` | integer, string, string | string |
| `http.redirect(status, url)` | integer, string | string |
| `http.setHeader(name, value)` | string, string | string |
| `http.setCache(seconds)` | integer | integer |
| `http.noCache()` | — | integer |

### Authentication

| Function | Parameters | Returns |
|----------|-----------|---------|
| `auth.getSession()` | — | string (JSON) |
| `auth.requireAuth()` | — | boolean |
| `auth.requireRole(role)` | string | boolean |
| `auth.can(permission)` | string | boolean |
| `auth.hasAnyRole(roles)` | string (JSON) | boolean |
| `auth.setSession(json)` | string | boolean |
| `auth.clearSession()` | — | boolean |
| `auth.userId()` | — | integer |
| `auth.userRole()` | — | string |

### Session

| Function | Parameters | Returns |
|----------|-----------|---------|
| `session.get()` | — | string (JSON) |
| `session.delete()` | — | boolean |
| `session.exists(id)` | string | boolean |
