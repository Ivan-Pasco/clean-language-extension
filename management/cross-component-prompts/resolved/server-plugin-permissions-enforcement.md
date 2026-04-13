Component: clean-server
Issue Type: feature
Priority: critical
Description: Implement runtime enforcement of plugin bridge function permissions

Defense-in-depth for the plugin permission system. The compiler validates permissions at build time (see companion prompt: compiler-plugin-permissions.md). The server must also enforce permissions at runtime to catch cases where a WASM module bypasses the compiler's checks.

## Architecture

```
Compile time (compiler):
  - Reads plugin.toml [bridge] declarations
  - Validates plugin code only calls declared functions
  - Embeds permission manifest in compiled WASM metadata

Runtime (server):
  - Reads permission manifest from WASM module
  - Creates per-plugin allowlist
  - Before executing any bridge function, checks the calling module's allowlist
  - Rejects unauthorized calls with PERMISSION_DENIED error
```

## Implementation Requirements

### 1. Permission Manifest in WASM

The compiler embeds a custom section in the WASM binary:
```
Custom section: "clean:permissions"
Content: JSON array of allowed bridge function names
```

The server reads this section when loading the WASM module.

### 2. Runtime Allowlist

When the server instantiates a WASM module, it:
1. Reads the `clean:permissions` custom section
2. Builds a `HashSet<String>` of allowed function names
3. Stores it alongside the module instance

### 3. Bridge Function Gating

The host bridge dispatch function (where bridge calls are routed) must:
1. Identify which WASM module is making the call
2. Check if the called function is in that module's allowlist
3. If not allowed, return the standard error envelope:
```json
{"ok": false, "err": {"code": "PERMISSION_DENIED", "message": "Plugin 'X' is not authorized to call 'Y'"}}
```

### 4. Logging

Log permission violations at WARN level:
```
WARN: Plugin 'malicious-plugin' attempted to call '_fs_read' without permission
```

## Why Both Compile-Time and Runtime?

- Compile-time catches mistakes during development
- Runtime catches:
  - Hand-crafted WASM that bypasses the compiler
  - Version mismatches (plugin compiled with old permissions, server has new restrictions)
  - Third-party WASM modules not compiled by the Clean compiler

## Context
This is the runtime half of the plugin security boundary. The compiler (separate prompt) handles compile-time enforcement. Together they ensure plugins can only access the resources they've declared, protecting user applications from malicious or misconfigured plugins.

## Files Affected
- WASM module loader — read `clean:permissions` custom section
- Bridge function dispatcher — check allowlist before executing
- Error handling — return PERMISSION_DENIED envelope
- Logging — warn on violations
