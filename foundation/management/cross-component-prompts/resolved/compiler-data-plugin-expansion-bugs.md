Component: clean-language-compiler
Issue Type: bug
Priority: critical
Description: Two bugs prevent frame.data plugin expansion from working: missing attributes parameter and class declarations rejected in plugin output

## Bug 1: Missing `attributes` Parameter in Plugin expand_block Call

### Expected Behavior
When the compiler encounters `data User`, it should call:
```
expand_block("data", "User", "integer id : pk, auto\nstring email : unique\n...")
```

Three parameters: block_name, attributes (model name), body.

### Actual Behavior
Debug output shows only 2 `write_clean_string` calls:
```
write_clean_string: len=4, ptr=524288   → "data" (block_name)
write_clean_string: len=77, ptr=524296  → body (fields)
```

The `attributes` parameter ("User") is never written to WASM memory. The plugin receives an empty or undefined attributes string.

### Impact
The plugin can't determine the model name from attributes. It falls back to parsing the body, but the field parsing logic expects `type name` format, not a model name.

### Where to Fix
The compiler's plugin expansion code that calls `expand_block`. Look for where it writes the three string parameters to WASM memory before calling the plugin function. The second parameter (attributes) is being skipped.

Likely location: `src/plugins/wasm_adapter.rs` or `src/codegen/` where plugin expand functions are invoked.

---

## Bug 2: Compiler Parser Rejects `class` Declarations in Plugin Output

### Expected Behavior
When a plugin returns expanded code containing `class User { ... }`, the compiler should accept it and compile the class definition.

### Actual Behavior
```
Parse error:
2 | 	class User
  | 	^---
  = expected statement
```

The compiler's parser tries to parse plugin output as a "statement" but `class` is a top-level declaration, not a statement. The parser context is wrong.

### Impact
Even when the plugin correctly generates class code, the compiler rejects it because it expects statements (function calls, assignments, etc.) rather than declarations (class, functions:, etc.).

### Where to Fix
The compiler's plugin output parsing code. After receiving the expanded output from a plugin, the parser should use the top-level program parser (that accepts class declarations, functions blocks, etc.), not the statement parser.

Look for the code that calls the pest parser on plugin output. It likely uses a rule like `statement` or `framework_block_content` when it should use `program` or `class_definition`.

### Debug Output
```
[Plugin Debug] Raw plugin output (3469 chars):
class User

	functions:
		boolean save()
			...

[Plugin Debug] Direct parse FAILED: Syntax error: Parse error:
  = expected statement
```

---

## Reproduction Steps

```bash
mkdir -p /tmp/test-data && cd /tmp/test-data
cat > app.cln << 'EOF'
plugins:
	frame.data

data User
	integer id : pk, auto
	string email : unique
	string name
	boolean active = true

start:
	printl("App started")
EOF

~/.cleen/versions/0.30.22/cln compile app.cln -o app.wasm --verbose
```

## Context
The frame.data plugin generates complete class definitions with ORM methods (save, delete, find, etc.). This worked in earlier compiler versions. The current compiler (0.30.22) has two issues that prevent the expansion from working:
1. Not passing the model name as the attributes parameter
2. Not accepting class declarations in plugin output

Both bugs must be fixed for the ORM system to function.

## Files Affected
- Plugin WASM call site (parameter passing for expand_block)
- Plugin output parser (accept class/functions declarations, not just statements)
