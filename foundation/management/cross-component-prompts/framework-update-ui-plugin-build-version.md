Component: clean-framework
Issue Type: required rebuild (compiler interface change)
Priority: CRITICAL — frame.ui html: blocks produce corrupted class attributes with compiler 0.30.104+
Source Component: clean-language-compiler
Updated: 2026-05-01 (supersedes previous prompt that pinned to 0.30.48)

---

## What Happened

Compiler 0.30.104 removed the Rust shims `html_block_to_code_rust` and
`strip_common_indent` from `wasm_adapter.rs` (architecture violation fix —
those functions duplicated frame.ui plugin logic inside the compiler).

The compiler now calls the plugin's own `expand_block` WASM function for ALL
block types including `html:`. There is no longer any Rust fallback.

The installed frame.ui 2.6.6 was compiled with compiler **0.30.48**, which
has a known local variable index mismatch bug in `extract_block_attributes`:
substring results are stored in local N but retrieved from local N+1, dropping
attribute names. With 0.30.104 calling the plugin's WASM directly, this bug is
now visible in production: `<div class="container">` generates `="container"`
instead of `class="container"`.

**This is a regression introduced by the compiler architectural fix.** The fix
is to rebuild frame.ui with the current compiler, which has both the
`i32.eqz` string comparison fix and the complex-function codegen fix.

---

## What Changed in the Compiler

`src/plugins/wasm_adapter.rs` — `call_expand` (and `call_expand_full`) no
longer contain:

```rust
// REMOVED — was in call_expand and call_expand_full:
if block_name == "html" {
    let code_str = html_block_to_code_rust(&stripped_body);
    // ...Rust reimplementation of html_block_to_code...
}
```

Both functions now always call `expand_block` directly:

```rust
let expand: TypedFunc<(i32, i32, i32), i32> = instance
    .get_typed_func(&mut store, expand_fn_name)?;
let result_ptr = expand.call(&mut store, (block_name_ptr, attributes_ptr, body_ptr))?;
```

The plugin is also no longer pre-processed with `strip_common_indent` before
being passed to `expand_block`. The plugin receives the raw block body and is
expected to handle its own indentation stripping via `strip_block_indent`.

---

## Verified: Both Original Bugs Are Fixed in 0.30.103+

The previous prompt pinned build.sh to 0.30.48 to avoid two codegen bugs.
Both are now confirmed fixed and do NOT require pinning:

1. **Local variable index mismatch** (affected 0.30.7 / mislabeled 0.31.0):
   substring results in multi-part string concat chains stored in wrong local.
   Fixed in the 0.30.x series. Compiler 0.30.103+ generates correct local
   indices — `attr_name` stored and retrieved from the same local.

2. **Complex-function returns empty** (affected 0.30.49–0.30.51):
   Functions with 89+ locals in large modules returned empty string.
   Fixed. Verified by `test_frame_ui_plugin_html_block_to_code_direct_wasm`
   in the compiler test suite: a frame.ui plugin compiled with 0.30.103 and
   called via `call_expand_full` (plugin WASM directly, no Rust shim) returns
   non-empty output and correctly preserves `class="container"`.

---

## Required Change

In `plugins/frame.ui/build.sh`, **replace the version pin** with the current
compiler from PATH:

```bash
# OLD (line 2) — pinned to avoid old codegen bugs, no longer needed:
CLN="${CLEEN_HOME:-$HOME/.cleen}/versions/0.30.48/cln"

# NEW — use the active compiler from PATH:
CLN="${CLEEN_HOME:-$HOME/.cleen}/versions/0.30.104/cln"
# Or, to always track the active version:
CLN=cln
```

The comment block explaining the 0.30.48 pin (lines 3–6) should also be
removed or updated to explain the new minimum: 0.30.103+.

---

## Verification Steps

After updating build.sh and rebuilding:

```bash
cd plugins/frame.ui && bash build.sh
```

Verify the rebuilt plugin handles class attributes correctly. Write a minimal
test:

```clean
// tests/cln/plugins/html_class_attr.cln
plugins:
	frame.ui

start:
	print(renderCard("Hello"))

functions:
	string renderCard(string title)
		html:
			<div class="container">
				<h1 class="title">{title}</h1>
			</div>
```

Expected output must contain `class="container"` and `class="title"` — NOT
`="container"` or `="title"`.

Also verify `{!expr}` raw interpolation (the other pattern that was previously
broken):

```clean
functions:
	string renderPage(string head, string body)
		html:
			{!head}
			<main>{body}</main>
```

Expected: generated code references `head` as a raw variable (not
`_html_escape(head)` with no argument, which was the old bug).

---

## Files to Change

- `plugins/frame.ui/build.sh` — remove 0.30.48 pin, use 0.30.104+ or `cln`
- `plugins/frame.ui/plugin.wasm` — rebuilt binary (committed to repo)

---

## Context

The Rust shims were added as a temporary workaround in April 2026
(architecture violation documented in `foundation/management/ARCHITECTURE_BOUNDARIES.md`).
They were removed in compiler 0.30.104 once the underlying codegen bugs were
verified fixed. The compiler test `test_frame_ui_plugin_html_block_to_code_direct_wasm`
in `src/plugins/wasm_adapter.rs` serves as the regression guard going forward.

Error report filed: FW001 (report_id bbb3c36b-546e-4530-ad5a-93c5237ea6ac).
