Component: clean-language-compiler (codegen)
Issue Type: unimplemented feature
Priority: high
Error Code: COMPILER_FN_POINTERS_UNIMPL
Fingerprint: 3ad647fd14e00a39abb11ab903bb4429820f7968b0efe4379fa5f907200cec3b
First reported version: 0.30.70
Dashboard: https://errors.cleanlanguage.dev (compiler/open)

## Description
Function references used as arguments (e.g., `ui.onEvent("body", "click", on_body_click)` where `on_body_click` is a Clean function) produce WARN lines during compilation and yield a WASM module with no `__indirect_function_table` export. Any runtime that attempts `call_indirect` or expects the indirect function table to exist breaks silently.

## Reproduction
```clean
plugins:
	frame.ui

start:
	integer s = ui.onEvent("body", "click", on_body_click)
	s = ui.setTimeout(delayed, 1000)

functions:
	on_body_click()
		integer s = 0
	delayed()
		integer s = 0
```

Observed:
```
$ cln compile --plugins test.cln -o out.wasm
... WARN: function reference 'on_body_click' used but function pointers not fully implemented
... WARN: function reference 'delayed' used but function pointers not fully implemented

$ grep -o "__indirect_function_table" out.wasm
(no output)
```

## Framework Workaround (already shipped)
frame.ui and frame.client have been updated so handler arguments are strings naming the exported function (see plugin.toml `_ui_on_event`, `_ui_set_timeout`, `_api_*`, `_live_open`, `_feed_*`). Runtimes dispatch via `instance.exports[handlerName]`. The framework no longer relies on the indirect function table.

However, the compiler WARN remains every time legacy user code uses `ui.onEvent("body", "click", on_body_click)` (identifier, not string). This should become a hard error with a migration hint OR the compiler should gain real function-pointer support and materialise the `__indirect_function_table`.

## Requested Fix
Option A — simplest: emit a hard error (`E0xxx: function-reference arguments require string form 'functionName'`) with a fix-it hint when a function identifier is passed as an argument to a bridge parameter declared as `"string"`. This turns the silent-drop footgun into a compile-time failure.

Option B — full: implement function pointers in codegen:
- Add an `__indirect_function_table` export populated with every address-taken Clean function.
- Assign each referenced function a stable index.
- Emit `i32.const <idx>` + `call_indirect` when a function identifier is used as a value.

Option B fully enables the `handler` type. Option A is enough to retire the `handler` type and standardise on string names.

## Files to Inspect (compiler)
- `src/codegen/mod.rs` / `src/codegen/mir_codegen.rs` — the active codegen path
- `src/semantic/*` — where function identifiers are resolved to values
- `src/parser/grammar.pest` — identifier-as-value expression rules

## Verification
Compile the repro; either:
- Option A: compile fails with a clear error and hint pointing at the identifier position.
- Option B: compile succeeds, `wasm-tools print out.wasm | grep indirect` shows `__indirect_function_table` export, and browser-side `instance.exports.__indirect_function_table.get(idx)` returns the target function.

## Framework-Side Status
The FRAME_UI_HANDLER_ABI_UNDEFINED family of bugs (frame.ui, frame.client) has been fixed via the string-name ABI. The compiler bug remains the underlying root cause; fixing it (Option A or B) closes the category.
