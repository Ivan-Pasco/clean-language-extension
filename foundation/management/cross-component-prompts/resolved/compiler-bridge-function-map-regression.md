# Compiler Bug: Bridge Functions Not Found in Function Map (v0.30.10 Regression)

**Component**: clean-language-compiler
**Issue Type**: bug/regression
**Priority**: critical
**Created**: 2026-01-27
**Version**: v0.30.10
**Source Component**: clean-framework (plugin compilation)
**Status**: ✅ RESOLVED in v0.30.11

## Resolution

Fixed in v0.30.11 with two changes:

1. **Fixed selective bridge function detection** (`src/codegen/mir_codegen.rs`):
   - `collect_used_function_names_from_mir()` now resolves `MirOperand::Function(symbol_id)` calls
   - Uses `mir_program.symbol_name_map` to look up function names from SymbolIds
   - Bridge functions called via SymbolId are now correctly identified as "used"

2. **Fixed external function symbol conflicts** (`src/resolver/resolver_impl.rs`):
   - Plugin bridge functions that match existing builtin functions are now allowed
   - When an external function conflicts with a builtin, registration is skipped (not errored)
   - This allows plugins to declare functions already registered as builtins

## Description

After the v0.30.10 release with "selective bridge imports" feature, bridge functions declared in plugins are no longer being found during code generation. This is a regression that completely breaks plugin-based compilation.

## Error Messages

```
ERROR generating function function_name=start error=Codegen {
  context: ErrorContext {
    message: "Function '_http_route' (SymbolId(233)) not found in function map during code generation"
  }
}
```

```
ERROR generating function function_name=__route_handler_0 error=Codegen {
  context: ErrorContext {
    message: "Function '_db_query' (SymbolId(194)) not found in function map during code generation"
  }
}
```

## Reproduction

### Test File 1 (frame.httpserver only)
```clean
plugins:
	frame.httpserver

functions:
	string __route_handler_0()
		string val = _req_param("id")
		return "{\"val\":\"" + val + "\"}"

start()
	integer s = _http_route("GET", "/t/:id", 0)
```

### Test File 2 (frame.httpserver + frame.data)
```clean
plugins:
	frame.httpserver
	frame.data

functions:
	string __route_handler_0()
		string sql = "SELECT * FROM users"
		string result = _db_query(sql, "[]")
		return result

start()
	integer s = _http_route("GET", "/api/users", 0)
```

### Compilation Command
```bash
cln compile test.cln -o test.wasm
```

### Expected
Compilation succeeds, WASM file is created.

### Actual
```
error: Code Generation Error
Function '_http_route' (SymbolId(233)) not found in function map during code generation
```

## Root Cause Analysis

The v0.30.10 release included the "selective bridge imports" feature (commit `90e3cd2`). This feature was intended to only import bridge functions that are actually used in the code.

The bug is that while the selective import logic tracks which functions are used, it's **not adding those functions to the function map** that the code generator uses to resolve function calls.

## Investigation Points

1. **Check the selective imports implementation** - The logic that determines which bridge functions to import
2. **Check function map population** - Where bridge functions are added to the function map
3. **Check the order of operations** - Bridge functions may need to be added to function map BEFORE semantic analysis, not just before WASM generation

## Likely Fix

The bridge functions need to be added to the function map during or after plugin loading, but BEFORE code generation tries to resolve them.

Pseudo-code for the fix:
```rust
// During plugin loading or semantic analysis setup
for plugin in loaded_plugins {
    for bridge_fn in plugin.bridge_functions {
        // Add to function map so codegen can find it
        function_map.insert(bridge_fn.symbol_id, BridgeFunctionEntry {
            name: bridge_fn.name,
            params: bridge_fn.params,
            returns: bridge_fn.returns,
            is_external: true,
        });
    }
}

// Later, during WASM generation, only emit imports for USED functions
// But all declared functions must still be in the function map for resolution
```

## Files to Investigate

- `src/codegen/mod.rs` or `src/codegen/wasm.rs` - Function map and code generation
- `src/semantic/mod.rs` - Where bridge functions are registered
- `src/plugin/loader.rs` - Plugin loading and bridge function extraction
- The commit `90e3cd2` - "fix: string comparison and selective bridge imports"

## Testing After Fix

```bash
# Test 1: Simple httpserver
cat > /tmp/test1.cln << 'EOF'
plugins:
	frame.httpserver

start()
	integer s = _http_route("GET", "/", 0)
EOF
cln compile /tmp/test1.cln -o /tmp/test1.wasm
# Should succeed

# Test 2: httpserver + data
cat > /tmp/test2.cln << 'EOF'
plugins:
	frame.httpserver
	frame.data

functions:
	string __route_handler_0()
		return _db_query("SELECT 1", "[]")

start()
	integer s = _http_route("GET", "/", 0)
EOF
cln compile /tmp/test2.cln -o /tmp/test2.wasm
# Should succeed

# Test 3: Run on server
cleen server run /tmp/test1.wasm --port 3002
curl http://localhost:3002/
# Should work
```

## Priority

**CRITICAL** - This regression completely breaks all plugin-based compilation. No Clean Language code using plugins can be compiled with v0.30.10.

## Workaround

Revert to v0.30.9 until this is fixed:
```bash
cleen install 0.30.9
```

However, v0.30.9 has the string comparison bug, so neither version is fully functional.
