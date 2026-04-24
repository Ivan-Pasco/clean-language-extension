Component: clean-language-compiler
Issue Type: bug
Priority: critical
Source Component: clean-framework (frame.ui plugin) + Web Site Clean

## Summary

The compiler does not apply the `returns` type from `plugin.toml` bridge function declarations when type-checking user code that calls these functions via the `ui.*` dot-notation convention.

All `ui.*` functions (mapped from `_ui_*` bridge declarations) are resolved as returning `null` (void) instead of the declared `integer` or `string` return type.

## Error

```
error[E002]: Cannot unify types: () -> null and integer
  --> app/client/main.cln:6:8
   |
   6 | 	s = ui.onEvent(".navbar-toggle", "click", handle_toggle_nav)
     |        ^
     |        Cannot unify types: () -> null and integer
```

10 errors total in the website client code, all the same pattern.

## What the plugin declares

In `frame.ui/plugin.toml`:

```toml
[bridge]
functions = [
  { name = "_ui_onEvent", params = ["string", "string", "handler"], returns = "integer", ... },
  { name = "_ui_toggleClass", params = ["string", "string"], returns = "integer", ... },
  { name = "_ui_addClass", params = ["string", "string"], returns = "integer", ... },
  { name = "_ui_removeClass", params = ["string", "string"], returns = "integer", ... },
  { name = "_ui_clipboardWrite", params = ["string"], returns = "integer", ... },
  { name = "_ui_setTimeout", params = ["handler", "integer"], returns = "integer", ... },
  { name = "_ui_observeVisible", params = ["string", "string"], returns = "integer", ... },
  { name = "_ui_setState", params = ["string", "string"], returns = "integer", ... },
  { name = "_ui_filterByText", params = ["string", "string", "string", "string"], returns = "integer", ... },
  { name = "_ui_filterByAttr", params = ["string", "string", "string"], returns = "integer", ... },
  { name = "_ui_queryAddClass", params = ["string", "string"], returns = "integer", ... },
  { name = "_ui_queryRemoveClass", params = ["string", "string"], returns = "integer", ... },
  { name = "_ui_locationHref", params = ["string"], returns = "integer", ... },
]
```

All declare `returns = "integer"`.

## What the user code does

```clean
integer s = ui.onEvent(".navbar-toggle", "click", handle_toggle_nav)
s = ui.addClass(".navbar-menu", "active")
s = ui.removeClass("#copy-toast", "visible")
```

The convention is: `ui.onEvent(...)` maps to `_ui_onEvent(...)`. The compiler should apply the bridge function's return type (`integer`) to the call expression.

## Expected behavior

The compiler reads `plugin.toml`, finds `_ui_onEvent` with `returns = "integer"`, and when user code calls `ui.onEvent(...)`, the call expression type is `integer`.

## Actual behavior

The compiler treats `ui.onEvent(...)` as returning `null`/void, causing type mismatch errors when the return value is assigned to an `integer` variable.

## Affected functions

All bridge functions in `frame.ui/plugin.toml` that use the `_ui_*` → `ui.*` mapping convention and return `integer`. At least 13 functions are affected.

## Impact

The Clean Language website client (`app/client/main.cln`) cannot compile. All interactive UI functionality is broken.

## Compiler version

v0.30.47 (and likely v0.31.0/0.30.7 as well)

## Files to investigate

- Plugin bridge function loading: where does the compiler read `plugin.toml` and register bridge functions?
- Dot-notation resolution: where does `ui.onEvent` get resolved to `_ui_onEvent`?
- Return type propagation: is the `returns` field from plugin.toml being read and applied to the function's type signature?
