Component: clean-framework (frame.server plugin)
Issue Type: bug
Priority: high
Description: The frame.server plugin passes numeric handler indices to _http_route() but the compiler expects function names for handler parameters.

## Error

```
error: Code Generation Error
Expected function name for handler parameter, got Value(ValueId(2)). Pass a function name like 'myHandler' instead of a value.
```

## Root Cause

The plugin generates route registration like:
```clean
start:
    _http_route("GET", "/", 0)
```

But `_http_route` is declared in `plugin.toml` with the third parameter as type `handler`. The compiler's codegen expects handler parameters to be function names (strings), not numeric indices. The correct output should reference the handler function by name:

```clean
start:
    _http_route("GET", "/", __route_handler_0)
```

## Fix

In `~/.cleen/plugins/frame.server/src/main.cln`, change the route_calls generation (around line 157) from:

```clean
route_calls = route_calls + "\t_http_route(\"" + method + "\", \"" + path + "\", " + handler_idx.toString() + ")\n"
```

To:

```clean
route_calls = route_calls + "\t_http_route(\"" + method + "\", \"" + path + "\", __route_handler_" + handler_idx.toString() + ")\n"
```

This passes the function name `__route_handler_0` instead of the integer `0`.

## Context

This was the final error after fixing:
1. Plugin expand() trap (compiler codegen bugs v0.30.43, v0.30.44)
2. `any` type in generated code (framework fix)  
3. Section ordering in plugin output (compiler fix - lenient mode for plugin parsing)

## Verification

After fixing, recompile the plugin with `--target=plugin` and test:
```bash
cln compile --plugins -o /tmp/test.wasm /tmp/test_server.cln
```

## Files Affected

- `~/.cleen/plugins/frame.server/src/main.cln` — line ~157, route_calls generation
