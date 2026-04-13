# Compiler Regression: String Variable Assignment with String Literals Fails

Component: clean-language-compiler
Issue Type: bug
Priority: critical
Description: Compiler version 0.30.22 fails to compile `string variable = "literal"` inside function bodies. The error is "Expected variable name after type". This regression was introduced between 0.22.0 (works) and 0.30.22 (broken). Assignment from variables (`string x = other_var`) still works.
Context: Discovered while rebuilding the frame.ui plugin WASM. The plugin source uses `string result = ""` extensively and cannot be compiled with the current compiler.

---

## Reproduction

### Minimal failing test:
```clean
functions:
	string second()
		string rules = "hello"
		return rules
```

### Error output:
```
error[E001]: Expected variable name after type
  --> test.cln:3:10
   |
   1 | functions:
   2 | 	string second()
   3 | 		string rules = "hello"
     |          ^^^^^
     |          Expected variable name after type
   4 | 		return rules
```

### Working with variable assignment:
```clean
functions:
	string second(string input)
		string x = input
		return x
```
This compiles successfully on 0.30.22.

### Version history:
- **0.22.0** (Jan 12): Works correctly
- **0.30.0** (Jan 18): Works correctly (but adds extra imports to WASM that break plugin loading)
- **0.30.22** (Feb 27): **BROKEN** — string literal assignment fails

## Impact

- The frame.ui plugin cannot be compiled with the current compiler
- ANY Clean Language code that initializes string variables with literals fails
- The pattern `string x = ""` is fundamental and used throughout the codebase

## Root Cause Hypothesis

The parser likely has a regression in how it handles string literal expressions after the assignment operator. It correctly parses the type (`string`) and expects a variable name, but when the next token is `rules`, it fails. This suggests the parser might be confused about the context — possibly treating `string rules = "hello"` as a function signature rather than a variable declaration.

## Workaround

Compile with version 0.22.0 or earlier. The plugin was rebuilt using 0.22.0.

## Files Affected

- `src/parser/` — likely in statement parsing or variable declaration parsing
- `src/parser/grammar.pest` — possibly in the variable_declaration or statement rules
