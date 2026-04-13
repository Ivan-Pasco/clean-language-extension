Component: clean-framework (frame.ui plugin)
Issue Type: bug
Priority: critical
Source Component: Web Site Clean

## Summary

The `frame.ui` plugin functions (`ui.onEvent`, `ui.toggleClass`, `ui.addClass`, `ui.removeClass`, `ui.clipboardWrite`, `ui.setTimeout`, `ui.observeVisible`, `ui.setState`, `ui.filterByText`, `ui.filterByAttr`, `ui.queryAddClass`, `ui.queryRemoveClass`, `ui.locationHref`) previously returned `integer` but now return `null` (void).

This breaks all existing client code that captures the return value to satisfy Clean Language's requirement that function call results be used.

## Error

```
error[E002]: Cannot unify types: () -> null and integer
  --> app/client/main.cln:6:8
   |
   6 | 	s = ui.onEvent(".navbar-toggle", "click", handle_toggle_nav)
     |        ^
     |        Cannot unify types: () -> null and integer
```

10 errors total, all the same pattern.

## Affected pattern

All existing client code uses this pattern (which worked before):

```clean
integer s = ui.onEvent(".navbar-toggle", "click", handle_toggle_nav)
s = ui.addClass(".navbar-menu", "active")
s = ui.removeClass("#copy-toast", "visible")
s = ui.setTimeout(handle_copy_dismiss, 2000)
s = ui.observeVisible(".animate-on-scroll", "animated")
```

The `integer s` variable exists because Clean Language requires function return values to be consumed. If these functions now return void/null, what is the correct calling convention?

## Questions for the framework team

1. Was this change intentional? If so, what is the new calling convention for void-returning UI functions?
2. If not intentional, the plugin.toml or plugin.wasm bridge declarations need to restore `integer` return types
3. Does the Clean Language spec support calling void functions without capturing a return value? (e.g., just `ui.onEvent(...)` on its own line)

## Impact

The Clean Language website client WASM (`app/client/main.cln`) cannot compile. All 10 `ui.*` calls fail with type mismatch errors.

## Files

- Plugin: `~/.cleen/plugins/frame.ui/2.6.1/plugin.wasm` (86,482 bytes)
- Client code: `app/client/main.cln` (93 lines, 10 broken calls)
- Compiler: v0.30.47
