# Cross-Component Prompt: Fix != Operator Parse Bug in Plugin Output

**Component:** clean-language-compiler
**Issue Type:** bug
**Priority:** medium
**Created:** 2026-01-24
**Created By:** clean-framework (frame.httpserver plugin development)
**Status:** 🔄 LIKELY FIXED - Retest with v0.30.4

## Analysis

This issue is **likely caused by the plugin string corruption bug** that was fixed in v0.30.3 and v0.30.4.

**Evidence:**
1. The workaround code in this report uses `.indexOf()` and `.substring()`:
   ```clean
   integer neq_pos = transformed.indexOf(" != ")
   string before = transformed.substring(3, neq_pos)
   string after = transformed.substring(neq_pos + 4, transformed.length())
   ```

2. These exact functions were **missing from the plugin runtime** and returning garbage/corrupted data.

3. The fix in v0.30.3 added:
   - `string.substring` / `string_substring`
   - `string.indexOf` / `string_indexOf`
   - 12 other missing string functions

4. The fix in v0.30.4 added:
   - `string.trim` / `string_trim` (dot notation)
   - Bounds checking for safety

**The `!=` operator parsing itself is correct** - the grammar properly defines:
```pest
comparison_op = { "==" | "!=" | "<=" | ">=" | "<" | ">" | comparison_op_is }
```

**Recommended Action:** Retest the frame.httpserver plugin with Clean Language v0.30.4 to verify the `!=` operator works correctly now that string functions are properly implemented.

---

## Description

The compiler's "Direct parse" step fails to parse the `!=` (not equals) operator when it appears in plugin output, even though the same syntax works when compiled from a regular `.cln` file.

## Reproduction Steps

1. Create a plugin that generates code with a `!=` comparison:

```clean
// Plugin output
functions:
	string handler()
		string a = getValue()
		string b = getOther()
		if a != b
			return "different"
		return "same"
```

2. The Direct parse step fails with:
```
Parse error:   --> 5:8
   |
5 | 		if a != b
   | 		     ^---
   |
   = expected indented_block, logical_op, default_op, comparison_op_is, additive_op, multiplicative_op, or power_op
```

3. If you change `!=` to `==`, the Direct parse succeeds.

4. If you copy the exact same code to a `.cln` file and compile directly, `!=` works fine.

## Evidence

**Plugin output with `!=` (FAILS):**
```
if password != confirm
	return badRequest("error")
```
Error: Direct parse FAILED

**Plugin output with `==` (WORKS):**
```
if password == confirm
	return badRequest("error")
```
Result: Direct parse succeeded

**Same code in .cln file (WORKS):**
```clean
if a != b
	return "different"
```
Result: Successfully compiled

## Workaround

In the frame.httpserver plugin, we transform `!=` to `not (... == ...)`:

```clean
// Transform "if a != b" to "if not (a == b)"
integer neq_pos = transformed.indexOf(" != ")
if neq_pos > 0
	string before = transformed.substring(3, neq_pos)
	string after = transformed.substring(neq_pos + 4, transformed.length())
	transformed = "if not (" + before + " == " + after + ")"
```

## Suspected Cause

The "Direct parse" step (used for plugin output validation) may have different parsing rules than the normal compilation path. The `!=` operator might not be recognized in this context.

Possible locations:
- `src/plugins/mod.rs` - Plugin output parsing
- `src/parser/` - Grammar rules for Direct parse mode

## Files Affected

- The plugin output parsing logic in the compiler
- Possibly the grammar rules for operator parsing

## Expected Behavior

The `!=` operator should work identically in plugin output as it does in regular `.cln` files.
