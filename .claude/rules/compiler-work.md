---
description: Compiler-specific rules — active when working in clean-language-compiler/
globs: ["clean-language-compiler/**"]
alwaysApply: false
---

# Compiler Work Rules

## Maturity Level: Foundation
The compiler is at Foundation maturity. This means:
- Fix existing failures before adding new features.
- Upstream-first: fix parser bugs before codegen bugs.
- Every change must maintain or improve the test pass rate.

## Known Fragile Areas
Read `clean-language-compiler/KNOWLEDGE.md` before modifying:
- String heap pointer initialization order
- String comparison inversion logic
- Dual codegen paths (mod.rs vs mir_codegen.rs)
- Recursive function pre-registration
- Stack balance in type conversions

## No Plugin Logic in the Compiler (CRITICAL)
The compiler calls plugins via WASM — it does NOT contain plugin-specific logic.
- **NEVER** reimplement plugin functions (expand_block, html_block_to_code, etc.) in Rust
- **NEVER** add HTML tag knowledge, attribute parsing, or template syntax to the compiler
- **NEVER** "workaround" broken plugin output by duplicating the plugin's logic
- If plugin WASM produces wrong output → the bug is in the **codegen** that compiled the plugin
- Fix the codegen bug → recompile the plugin → the plugin works correctly
- See `foundation/management/ARCHITECTURE_BOUNDARIES.md` "The Workaround Trap" section

## Principle 26 — Plugin Output Broken: Investigation Protocol (NOT a Shim)

When a plugin's WASM function produces wrong output, follow this decision tree **before writing a single line of Rust**:

### Step 1: Identify the category of failure

| Symptom | Root cause | Fix lives in |
|---------|-----------|--------------|
| Plugin returns empty string | Codegen bug in local variable scoping or string ops | `src/codegen/mod.rs` |
| Plugin generates wrong code (bad identifiers, missing args) | Codegen bug in string comparison / substring ops | `src/codegen/mod.rs` |
| Plugin panics or traps | Plugin source logic error OR wasmtime sandbox issue | `src/plugins/wasm_adapter.rs` stubs only |
| Plugin generates code that fails to parse | Codegen bug in string escaping | `src/codegen/mod.rs` or `src/plugins/wasm_adapter.rs` escape utils |

### Step 2: Before writing anything in wasm_adapter.rs, run this check

```bash
grep -n "html\|template\|interpolat\|strip.*indent\|block_to_code" src/plugins/wasm_adapter.rs
```

If that grep returns lines with logic (not just stubs), **STOP** — you are about to add a second violation on top of an existing one. Fix the codegen instead.

### Step 3: What IS allowed in wasm_adapter.rs

**Allowed (stubs only):**
```rust
// Stub for missing host import — no logic, zero return
linker.func_wrap("env", "_res_redirect", |_: i32, _: i32, _: i32| -> i32 { 0 })?;
```

**Allowed (string escaping utilities):**
Escaping characters that would produce invalid Clean Language syntax in generated code — but ONLY as a post-processing guard, never as a replacement for the plugin's own logic.

**NOT allowed:**
- Any function that parses HTML, template syntax, or DSL blocks
- Any function that generates Clean Language code fragments
- Any function named after a plugin function (html_block_to_code_rust, strip_common_indent, etc.)

### Step 4: How to find the codegen bug

Plugin WASM is compiled from Clean Language source in `clean-framework/`. The most common codegen bugs that corrupt plugin output:

1. **String comparison bug** — check `src/codegen/mod.rs` for `string_compare` / `_str_eq` generation
2. **Substring result type** — check how `string.slice` / `string.substring` results are typed and stored
3. **Local variable scoping in WASM** — check that local variables inside plugin functions are not being shared across calls

Write a minimal `.cln` test that reproduces the codegen bug directly (not via the plugin), fix it there, then verify the plugin output corrects itself.

### Step 5: If the codegen fix is beyond current scope

Do NOT add a Rust shim. Instead:
1. File a report via `report_error` with `component=compiler`, `discovered_during` = the plugin that's broken
2. Add a TASKS.md entry with the specific codegen path and symptom
3. Note the affected plugin and version in the entry
4. Continue with other work — a known-broken plugin is better than a hidden violation

**The violation history**: `html_block_to_code_rust` and `strip_common_indent` in `wasm_adapter.rs` are active violations of this principle added in April 2026 as workarounds for a codegen bug. They must be removed once the codegen bug is fixed. See ARCHITECTURE_BOUNDARIES.md History table.

## Build Verification
After any change to `src/`:
```bash
cargo check
cargo test --lib
```

## Spec References
- Grammar: `foundation/spec/grammar.ebnf`
- Semantic rules: `foundation/spec/semantic-rules.md`
- Type system: `foundation/spec/type-system.md`
- Built-ins: `foundation/spec/stdlib-reference.md`
