Component: clean-language-compiler
Issue Type: feature
Priority: high
Description: Add `handler` parameter type for plugin bridge functions

## Context

The framework plugins (frame.ui, frame.client) use async callback patterns where a bridge function accepts a handler index to dispatch responses to. Currently the developer writes:

```clean
// BAD: Numbers are not intuitive, error-prone, unmaintainable
start:
    integer s = ui.onEvent(".btn", "click", 0)

functions:
    handle_event_0()
        integer s = api.get("/api/users", 1)

    handle_event_1()
        string name = api.json("name")
```

This should be:

```clean
// GOOD: Named functions, self-documenting, Clean Language philosophy
start:
    integer s = ui.onEvent(".btn", "click", loadUsers)

functions:
    loadUsers()
        integer s = api.get("/api/users", onUsersLoaded)

    onUsersLoaded()
        string name = api.json("name")
```

## What Already Exists

1. **`function` type** already exists in Clean Language -- used in `map()`, `filter()`, `reduce()`, `forEach()`. Function references as parameters are a language feature.

2. **Server-side endpoints already do name→index mapping** -- `GET "/path" -> listUsers` in the `endpoints:` block. The plugin expansion assigns numeric indices internally. The developer never sees numbers.

3. **loader.js dispatches by index** -- `instance.exports['handle_event_' + handlerIdx]()`. This is the runtime convention that should remain internal.

## Required Compiler Change

### 1. New param type `handler` in plugin.toml

```toml
# Before (current):
{ name = "_ui_onEvent", params = ["string", "string", "integer"], ... }

# After (new):
{ name = "_ui_onEvent", params = ["string", "string", "handler"], ... }
```

The `handler` type tells the compiler: "this parameter accepts a function name, not a literal integer."

### 2. Compiler behavior when it sees `handler` type

When the compiler encounters a bridge function call with a `handler` parameter:

a. Accept a function name (identifier) in that position
b. Verify the function exists in the current scope (inside `functions:` block)
c. Assign a unique integer index to that function (auto-incrementing)
d. Export the function as `handle_event_N` in the WASM module (where N = assigned index)
e. Pass N as the i32 value at the WASM level

### 3. WASM-level behavior (unchanged)

At the WASM level, `handler` compiles to `i32` -- same as `integer`. The runtime (loader.js) continues to dispatch via `instance.exports['handle_event_' + idx]`. No runtime changes needed.

### 4. Compiler validation

- Error if the function name doesn't exist: `"Unknown handler function 'onLoad' -- did you define it in functions: block?"`
- Error if a literal integer is passed: `"Expected function name, got integer. Pass a function name like 'myHandler' instead of a number."`
- Warning if the same function is used as handler in multiple places (valid but worth noting)

### 5. Index assignment strategy

- Indices are assigned in order of first reference (first `handler` parameter encountered gets 0, next gets 1, etc.)
- The same function referenced multiple times gets the same index
- Indices are per-module (per .cln file compilation unit)

## Example: Full Compilation Flow

Clean source:
```clean
start:
    integer s = ui.onEvent(".btn", "click", saveUser)
    s = ui.setTimeout(clearStatus, 2000)

functions:
    saveUser()
        integer s = api.post("/api/users", body, onSaved)

    onSaved()
        integer s = ui.updateElement("#msg", "Saved!")

    clearStatus()
        integer s = ui.updateElement("#msg", "")
```

Compiler assigns:
- `saveUser` → index 0
- `clearStatus` → index 1
- `onSaved` → index 2

Generated WASM exports:
- `handle_event_0` → calls `saveUser` body
- `handle_event_1` → calls `clearStatus` body
- `handle_event_2` → calls `onSaved` body

Generated WASM for `start:`:
```
call _ui_onEvent(".btn", "click", 0)    ;; 0 = saveUser
call _ui_setTimeout(1, 2000)            ;; 1 = clearStatus
```

Generated WASM for `saveUser`:
```
call _api_post("/api/users", body, 2)   ;; 2 = onSaved
```

## Affected Plugins

All plugins that use handler callbacks need their plugin.toml updated:

### frame.ui (existing)
```toml
# Change integer → handler for these functions:
_ui_onEvent:    params = ["string", "string", "handler"]
_ui_setTimeout: params = ["handler", "integer"]
```

### frame.client (new)
```toml
_api_get:    params = ["string", "handler"]
_api_post:   params = ["string", "string", "handler"]
_api_put:    params = ["string", "string", "handler"]
_api_patch:  params = ["string", "string", "handler"]
_api_delete: params = ["string", "handler"]
_api_submit: params = ["string", "string", "string", "handler"]
_live_open:  params = ["string", "handler", "handler", "handler"]
_feed_open:  params = ["string", "handler", "handler"]
_feed_on:    params = ["integer", "string", "handler"]
```

## Files Affected

- `src/plugins/` -- plugin.toml parser: recognize `handler` type
- `src/codegen/` -- bridge function codegen: resolve function names to indices
- `src/semantic/` -- type checking: validate handler references
- `src/resolver/` -- resolve handler function names in scope
- Plugin Architecture documentation

## Why This Matters

- `handle_event_0()` is not Clean Language -- it's a WASM implementation detail that leaked into DX
- Clean Language values readability and simplicity
- The `endpoints:` block already proves this pattern works
- Every developer who sees `handle_event_3()` will ask "what does 3 mean?"
- Named handlers make code self-documenting
