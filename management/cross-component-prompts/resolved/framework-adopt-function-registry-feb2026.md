Component: clean-framework
Issue Type: enhancement
Priority: high
Description: |
  A shared function registry has been created at `platform-architecture/function-registry.toml`
  that defines ALL 201 host functions (Layer 2 + Layer 3) with exact signatures.
  The framework should validate its plugin.toml files against this registry to ensure
  all declared bridge functions match the registry's authoritative definitions.

Context: |
  During the host-bridge/plugin/compiler alignment audit, we found mismatches between
  plugin.toml declarations and actual server implementations. The registry is now the
  single source of truth, validated by automated spec compliance tests in clean-server.

## What the Registry Provides

File: `../platform-architecture/function-registry.toml`

Each function entry has:
```toml
[[functions]]
name        = "_session_store"
layer       = 3
category    = "session"
module      = "env"
params      = ["string", "string"]
returns     = "boolean"
aliases     = []
description = "Store raw data string under given session ID key"
```

### Type Expansion Rules

These match the plugin.toml convention (with `expand_strings = true`):

| High-Level Type | WASM Expansion |
|----------------|----------------|
| `"string"` | `(i32, i32)` |
| `"integer"` | `(i64)` |
| `"number"` | `(f64)` |
| `"boolean"` | `(i32)` |
| `"i32"` | `(i32)` |
| `"ptr"` | `(i32)` return only |
| `"void"` | no return |

## Recommended Adoption

### Step 1: Validate Plugin Declarations Against Registry

Create a test or build-time check that:
1. Parses `function-registry.toml`
2. Parses each `plugins/*/plugin.toml`
3. For every function declared in a plugin.toml, verifies it exists in the registry
4. Verifies param types and return types match

### Step 2: Specific Plugin Updates Needed

Based on the current audit:

#### frame.data plugin.toml
Add transaction functions (already implemented in server):
```toml
_db_begin = { params = [], returns = "integer" }
_db_commit = { params = [], returns = "integer" }
_db_rollback = { params = [], returns = "integer" }
```

#### frame.httpserver plugin.toml
Verify these auth functions are declared:
- `_auth_set_session` — params: `["string"]`, returns: `"boolean"`
- `_auth_clear_session` — params: `[]`, returns: `"boolean"`
- `_auth_user_id` — params: `[]`, returns: `"i32"`
- `_auth_user_role` — params: `[]`, returns: `"ptr"`

#### HTTP Client Plugin (new)
Consider creating `frame.httpclient` plugin for the 22 HTTP client functions.
All functions are listed in the registry under `category = "http_client"`.

### Step 3: Automated Compliance Test

Add a test that parses both the registry and all plugin.toml files, checking:
- Every plugin function has a matching registry entry
- Param count and types match
- Return type matches

## What This Replaces

This registry replaces the need for these previous cross-component prompts:
- `framework-plugin-alignment-feb2026.md`
- `framework-align-plugin-naming.md`

Those documented individual function mismatches. The registry approach means
future changes are automatically detected by the validation test.

## Files Affected

- `plugins/frame.auth/plugin.toml` — verify alignment
- `plugins/frame.data/plugin.toml` — add transaction functions
- `plugins/frame.httpserver/plugin.toml` — add auth functions
- New plugin for HTTP client functions (optional)
- New test for registry validation
