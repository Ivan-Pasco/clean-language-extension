# Compiler — `Array<T>` vs `list<T>` Type Spec Mismatch

Component: clean-language-compiler
Issue Type: bug
Priority: medium
Description: The MCP quick reference and language spec document `Array<T>` as the collection type, but the compiler only accepts `list<T>`. Using `Array<string>` causes `Unsupported statement type: Assign` error. Using `list<string>` compiles fine.

Context: Discovered while testing `split()` on the website project. The spec examples show `Array<integer> nums = [1, 2, 3]` and `Array<string> parts = s.split(" ")`, but only `list<string> parts = s.split(",")` actually compiles.

---

## What the Spec Says

```clean
# From get_quick_reference:
Array<integer> nums = [1, 2, 3, 4, 5]
integer first = nums[0]
integer len = nums.length()
nums.push(6)

Array<string> parts = s.split(" ")
```

## What Actually Works

```clean
# list<T> compiles, Array<T> does not
list<string> parts = test_str.split(",")
```

## What Fails

```clean
# Array<T> does NOT compile
Array<string> parts = test_str.split(",")
# Error: Unsupported statement type: Assign
```

## Fix Options

Either:
1. **Fix the compiler** to accept `Array<T>` as documented in the spec
2. **Update the spec/MCP** to document `list<T>` as the correct type
3. **Support both** as aliases (preferred — avoid breaking existing code)

## Versions

- Compiler: v0.30.20
- MCP server: v0.30.20
