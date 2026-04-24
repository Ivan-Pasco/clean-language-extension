Component: clean-language-compiler
Issue Type: compatibility
Priority: critical
Description: |
  The clean-server host bridge (Layer 2) has been updated to match the HOST_BRIDGE.md spec exactly.
  All string and console functions now use raw (ptr, len) pairs instead of length-prefixed single
  pointers. The compiler MUST generate WASM imports matching these exact signatures, otherwise
  WASM module instantiation will fail.

Context: |
  During a comprehensive spec compliance audit of clean-server, we found ~24 functions had
  WASM-level signature mismatches (wrong parameter counts/types). These have all been fixed.
  A spec compliance test (spec_compliance.wat) now guards against future signature drift.
  The clean-node-server was already compliant.

## Changes Made (clean-server host-bridge)

### Console Functions (console.rs)
| Function | OLD Signature | NEW Signature |
|----------|--------------|---------------|
| `print_string` | `(ptr: i32)` | `(ptr: i32, len: i32)` |
| `print_integer` | `(value: i32)` | `(value: i64)` |
| `console_log` | `(ptr: i32)` | `(ptr: i32, len: i32)` |
| `console_error` | `(ptr: i32)` | `(ptr: i32, len: i32)` |
| `console_warn` | `(ptr: i32)` | `(ptr: i32, len: i32)` |

### String Functions (string_ops.rs)
| Function | OLD Signature | NEW Signature |
|----------|--------------|---------------|
| `string.concat` | `(ptr1, ptr2) -> i32` | `(a_ptr, a_len, b_ptr, b_len) -> i32` |
| `string_substring` | `(str_ptr, start, end) -> i32` | `(ptr, len, start, end) -> i32` |
| `string_trim` | `(str_ptr) -> i32` | `(ptr, len) -> i32` |
| `string_to_upper` | `(str_ptr) -> i32` | `(ptr, len) -> i32` |
| `string_to_lower` | `(str_ptr) -> i32` | `(ptr, len) -> i32` |
| `string_replace` | `(str_ptr, search_ptr, replace_ptr) -> i32` | `(ptr, len, find_ptr, find_len, replace_ptr, replace_len) -> i32` |
| `string_split` | `(str_ptr, delim_ptr) -> i32` | `(ptr, len, delim_ptr, delim_len) -> i32` |
| `string_index_of` | `(str_ptr, search_ptr) -> i32` | `(haystack_ptr, haystack_len, needle_ptr, needle_len) -> i32` |
| `string_compare` | `(str1_ptr, str2_ptr) -> i32` | `(a_ptr, a_len, b_ptr, b_len) -> i32` |
| `int_to_string` | `(value: i32) -> i32` | `(value: i64) -> i32` |
| `string_to_int` | `(str_ptr: i32) -> i32` | `(ptr: i32, len: i32) -> i64` |
| `string_to_float` | `(str_ptr: i32) -> f64` | `(ptr: i32, len: i32) -> f64` |
| `string_to_bool` | `(str_ptr: i32) -> i32` | `(ptr: i32, len: i32) -> i32` |

All dot-notation aliases (string.trim, string.toUpperCase, etc.) have the same signatures as their underscore counterparts.

### File I/O (file_io.rs)
| Function | OLD Signature | NEW Signature |
|----------|--------------|---------------|
| `file_read` | `(path_ptr, path_len, max_size) -> i32` | `(path_ptr, path_len) -> i32` |

## Key Principle
ALL string parameters in host bridge functions now use raw `(ptr: i32, len: i32)` pairs.
The compiler must generate `(import "env" "function_name" (func (param ...) (result ...)))`
with the EXACT parameter counts and types listed above.

## Suggested Fix
In the codegen module where WASM imports are generated for these built-in functions,
update the import declarations to match the new signatures. The critical change is that
string parameters are now always `(ptr, len)` pairs, not single length-prefixed pointers.

## Files Affected
- Compiler's codegen module that generates WASM imports for built-in functions
- Any built-in function registry that defines parameter counts/types
- Any string expansion logic (`expand_strings`) that generates ptr+len pairs
