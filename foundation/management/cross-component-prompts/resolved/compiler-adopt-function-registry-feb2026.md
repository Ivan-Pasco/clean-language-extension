Component: clean-language-compiler
Issue Type: enhancement
Priority: high
Description: |
  A shared function registry has been created at `platform-architecture/function-registry.toml`
  that defines ALL 201 host functions (Layer 2 + Layer 3) with exact signatures.
  The compiler should adopt this registry for WASM import generation instead of
  maintaining its own hardcoded function map.

Context: |
  During the host-bridge/plugin/compiler alignment audit, we found repeated signature
  mismatches because each component maintained its own copy of function signatures.
  The registry is now the single source of truth, validated by automated spec
  compliance tests in clean-server.

## What the Registry Provides

File: `../platform-architecture/function-registry.toml`

Each function entry has:
```toml
[[functions]]
name        = "_crypto_hash_password"     # WASM import name
layer       = 2                           # 2 = portable, 3 = server-only
category    = "crypto"                    # grouping
module      = "env"                       # WASM module ("env" or "memory_runtime")
params      = ["string"]                  # high-level param types
returns     = "ptr"                       # high-level return type
aliases     = []                          # alternate names (e.g., ["math.sin"])
description = "Hash password (bcrypt)"
```

### Type Expansion Rules

| High-Level Type | WASM Expansion | Notes |
|----------------|----------------|-------|
| `"string"` | `(i32, i32)` | ptr + len pair |
| `"integer"` | `(i64)` | 64-bit signed |
| `"number"` | `(f64)` | 64-bit float |
| `"boolean"` | `(i32)` | 0 or 1 |
| `"i32"` | `(i32)` | raw (port, count, index) |
| `"i64"` | `(i64)` | raw |
| `"ptr"` | `(i32)` | return: length-prefixed string pointer |
| `"void"` | no return | |

### Function Counts

- Layer 2 (portable): 108 canonical + 46 aliases = 154 total
- Layer 3 (server-only): 47 canonical = 47 total

## Recommended Adoption

### Step 1: Parse Registry in Compiler

Add a `toml` dependency and parse `function-registry.toml` at build time or test time.
Generate the compiler's bridge function map from the registry entries.

### Step 2: Add Spec Compliance Test

Create a test that:
1. Parses the registry
2. Compares each entry against the compiler's internal function map
3. Verifies param counts, param types, and return types match

Example (from clean-server's implementation):
```rust
fn expand_param_type(t: &str) -> Vec<&str> {
    match t {
        "string" => vec!["i32", "i32"],
        "integer" => vec!["i64"],
        "number" => vec!["f64"],
        "boolean" => vec!["i32"],
        "i32" => vec!["i32"],
        "i64" => vec!["i64"],
        _ => panic!("Unknown param type: {}", t),
    }
}
```

### Step 3: Generate WASM Imports from Registry

Instead of hardcoded import declarations, the codegen module should:
1. Look up each function call in the registry
2. Expand high-level types to WASM types
3. Generate the correct `(import "env" "name" (func (param ...) (result ...)))` declaration

## What This Replaces

This registry replaces the need for these previous cross-component prompts:
- `compiler-host-bridge-signature-update-feb2026.md`
- `compiler-crypto-jwt-env-time-functions-feb2026.md`

Those documented individual function changes. The registry approach means future
changes are automatically picked up by parsing the TOML.

## Files Affected

- Compiler's codegen module for WASM import generation
- Built-in function registry / bridge function map
- Cargo.toml (add `toml` dependency)
- New test file for registry compliance
