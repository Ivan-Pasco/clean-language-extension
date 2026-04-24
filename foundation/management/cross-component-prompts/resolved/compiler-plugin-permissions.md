Component: clean-language-compiler
Issue Type: feature
Priority: critical
Description: Implement plugin permission parsing and compile-time enforcement

Plugins declare bridge functions in `plugin.toml` under `[bridge] functions`. The compiler must enforce that plugins can ONLY use bridge functions they have declared. This is a security boundary that prevents malicious or misconfigured plugins from accessing resources they shouldn't.

## Current State

Plugins declare their bridge functions:
```toml
# frame.auth/plugin.toml
[bridge]
functions = [
    { name = "_crypto_hash_password", ... },
    { name = "_session_store", ... },
    # etc.
]
```

The compiler reads these declarations to generate WASM imports. But it does NOT verify that the plugin code only calls declared functions.

## Required Implementation

### 1. Build permission allowlist per plugin

When loading a plugin's `plugin.toml`, collect all `[bridge] functions` names into a set:
```
frame.auth allowed: {_crypto_hash_password, _session_store, _session_get, _jwt_sign, ...}
frame.data allowed: {_db_query, _db_execute, _db_begin, _db_commit, ...}
```

### 2. Validate during code generation

When compiling a plugin's `src/main.cln`, track all bridge function calls in the generated code. After expansion, verify that every bridge function call is in the plugin's allowlist.

If a plugin calls a function it hasn't declared:
```
ERROR: Plugin 'frame.data' calls '_crypto_hash_password' which is not declared in its [bridge] functions.
       Add it to plugins/frame.data/plugin.toml or remove the call.
```

### 3. Cross-plugin function access

When plugin A's expanded code references a function from plugin B (e.g., frame.ui calling `csrf_generate()` from frame.auth), the compiler should:
- Check if plugin A depends on plugin B (declared in `plugin.toml`)
- If so, allow the call
- If not, emit an error suggesting adding the dependency

### 4. Permission categories (future)

Group bridge functions into categories for clearer permission management:
```toml
[permissions]
requires = ["crypto", "session", "env"]
```

This is a future enhancement — the immediate need is function-level enforcement.

## Context
Without permission enforcement, any plugin can call any bridge function. A malicious third-party plugin could access the filesystem, make network requests, or read environment variables (secrets) without the developer's knowledge. This is the most critical security boundary in the plugin system.

## Files Affected
- Plugin manifest parser — collect bridge function allowlist
- Code generation — validate all bridge calls against allowlist
- Error reporting — clear error messages for permission violations
