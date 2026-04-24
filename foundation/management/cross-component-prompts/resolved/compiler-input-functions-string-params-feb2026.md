# Cross-Component Issue: Compiler Generates Wrong Signature for `input` Family Functions

**Component**: clean-language-compiler
**Issue Type**: bug
**Priority**: CRITICAL — blocks ALL WASM execution on clean-server v1.8.x
**Created**: 2026-02-21
**Source Component**: clean-server (bug report from Website Clean project)

---

## Summary

The compiler generates WASM imports for the `input` family of functions using a single `i32` for the string prompt parameter. The function registry (authoritative spec) and clean-server v1.8.x both expect a `(ptr: i32, len: i32)` pair — two i32s — for every `string` parameter. This mismatch causes `incompatible import type for env::input` at WASM instantiation time, blocking ALL application execution on v1.8.x.

---

## The Mismatch

The platform spec (`platform-architecture/function-registry.toml`) is the authoritative source for all host function signatures. It defines `string` parameters as expanding to `(ptr: i32, len: i32)` pairs.

| Function | Registry spec | Server v1.8.x | Compiler generates | Status |
|---|---|---|---|---|
| `input` | `(i32, i32) -> i32` | `(i32, i32) -> i32` | `(i32) -> i32` | ❌ WRONG |
| `console_input` | `(i32, i32) -> i32` | `(i32, i32) -> i32` | `(i32) -> i32` | ❌ WRONG |
| `input_integer` | `(i32, i32) -> i64` | `(i32, i32) -> i64` | `(i32) -> i32` | ❌ WRONG (also wrong return type) |
| `input_float` | `(i32, i32) -> f64` | `(i32, i32) -> f64` | `(i32) -> f64` | ❌ WRONG |
| `input_yesno` | `(i32, i32) -> i32` | `(i32, i32) -> i32` | `(i32) -> i32` | ❌ WRONG |
| `input_range` | `(i32, i32, i32, i32) -> i32` | `(i32, i32, i32, i32) -> i32` | `(i32, i32, i32, i32) -> i32` | ✅ OK |

The server v1.8.x is **correct** — it was updated to follow the registry spec. The compiler has **not been updated** and still generates single-i32 imports for string prompt parameters.

Note: `input_range` accidentally works because `"string"` + two `i32` params = 4 i32 params total, same as the compiler's `"ptr, min, max, step"` interpretation.

---

## Root Cause

The compiler treats length-prefixed string pointers as a single `i32` when generating WASM import declarations for host functions. But the function registry spec says `"string"` in `params` expands to TWO i32s: `(ptr: i32, len: i32)`.

The compiler must be updated so that when it generates WASM `import` declarations for Layer 2/3 host functions, each `string` parameter in the registry expands to two `i32` parameters in the WASM type signature.

---

## Where to Fix in Compiler

Search for where the compiler generates WASM import declarations for host functions:

```bash
# Find where host function imports are generated
grep -r "input\|_http_\|console\|import" src/codegen/ --include="*.rs" | grep -i "input\|string.*i32\|param"

# Find the host function signature table / import registry
grep -r "input\|host.*func\|wasm.*import" src/ --include="*.rs" | head -30
```

The fix is in the **import declaration** — wherever the compiler builds the WASM type section for `env::input`, it must emit `[i32, i32] -> [i32]` instead of `[i32] -> [i32]`.

### Likely files:
- `src/codegen/` — code generation for WASM imports
- `src/codegen/host_functions.rs` (or similar) — host function signature table
- `src/stdlib/` — if input functions are declared here

---

## Reproduction

Any WASM compiled with the current compiler fails on v1.8.x:

```bash
# Minimal test (input not even called, just imported)
cat > /tmp/test.cln << 'EOF'
start:
    integer s = _http_route("GET", "/", 0)
    s = _http_listen(3099)

functions:
    string __route_handler_0()
        return _http_respond(200, "text/plain", "ok")
EOF

cln compile /tmp/test.cln -o /tmp/test.wasm

# Fails:
~/.cleen/server/v1.8.3/clean-server /tmp/test.wasm --port 3099
# ERROR: incompatible import type for `env::input`

# Works (old server had wrong signature):
~/.cleen/server/1.7.11/clean-server /tmp/test.wasm --port 3099
```

---

## Fix Verification

After fixing, run:
```bash
# Inspect generated WASM
wasm-objdump -x /tmp/test.wasm | grep "input"
# Should show: (i32, i32) -> i32 for env::input

# Run on server
~/.cleen/server/v1.8.3/clean-server /tmp/test.wasm --port 3099
curl http://localhost:3099/
# Should return "ok"
```

Also verify the spec compliance test passes in the compiler:
```bash
cargo test spec_compliance
```

---

## Broader Impact

This same bug may affect other host functions that take `string` parameters. Any host function where the compiler generates a single `i32` for what the registry defines as a `string` (ptr+len) parameter will fail.

Recommended: after fixing `input`, audit ALL host function import declarations in the compiler against `platform-architecture/function-registry.toml` to ensure every `"string"` param maps to `(i32, i32)`.

---

## Server Side — No Change Needed

clean-server v1.8.x is **correct**. The server matches the function registry. Do not revert the server's `input` function signatures.
