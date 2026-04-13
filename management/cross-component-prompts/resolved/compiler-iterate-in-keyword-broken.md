# Compiler — `iterate (item in list)` Syntax Not Compiling

Component: clean-language-compiler
Issue Type: bug
Priority: high
Description: The `iterate (item in list)` syntax documented in the quick reference and language spec does not compile. The compiler returns `Expected identifier, found LeftParen` when encountering the `(` in `iterate (item in parts)`.

Context: Discovered while auditing the Clean Language website project to use modern language features. The `list<string>` type, `split()` method, `while` loops, and `parts[i]` indexing all work correctly. The ONLY missing piece is the `iterate` for-each syntax over collections.

---

## What Works (all verified on v0.30.20)

```clean
# list<string> type + split() — COMPILES
string test_str = "a,b,c"
list<string> parts = test_str.split(",")

# while loop + index access — COMPILES
integer i = 0
integer len = parts.length()
while (i < len)
    string item = parts[i]
    result = result + item + "-"
    i = i + 1
```

## What Fails

```clean
# iterate (item in list) — FAILS
iterate (item in parts)
    result = result + item + "-"

# Error: Expected identifier, found LeftParen
```

## Impact

This is the **#1 verbosity blocker** for the entire language. Without `iterate`, all list rendering in web apps must use SQL GROUP_CONCAT as a template engine — turning 5-line Clean Language loops into 30-line SQL queries. Fixing this single feature would:

1. Eliminate GROUP_CONCAT-as-template-engine pattern
2. Allow normal Clean Language loops for HTML generation
3. Make the language usable for any list-based rendering
4. Reduce typical page renderer from ~100 lines to ~40 lines

## Quick Reference Shows It Working

The MCP `get_quick_reference` tool documents this syntax:
```
// Iterate over array
iterate (item in myArray)
    print(item.toString())
```

## Suggested Fix

The parser likely doesn't handle `iterate (IDENT in EXPR)` correctly in the current grammar. The `iterate (i = 0 to 10)` range syntax may work, but the collection iteration variant needs to be added or fixed.

## Versions

- Compiler: v0.30.20
- Test: `cln compile --plugins` with frame.httpserver plugin
